import osjs from 'osjs';
import {name as applicationName} from './metadata.json';

const strftime = require('strftime');

import {
	h,
	app
} from 'hyperapp';

import {
	Box,BoxContainer,Button,Icon,Menubar,MenubarItem,RangeField,Video
} from '@osjs/gui';

const NM_DEVICE_TYPE = [
  'UNKNOWN','ETHERNET','WIFI','UNUSED1','UNUSED2','BT','OLPC_MESH','WIMAX','MODEM','INFINIBAND','BOND','VLAN',
  'ADSL','BRIDGE','GENERIC','TEAM','TUN','IP_TUNNEL','MACVLAN','VXLAN','VETH','MACSEC','DUMMY','PPP',
  'OVS_INTERFACE','OVS_PORT','OVS_BRIDGE','WPAN','6LOWPAN','WIREGUARD'
];

const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c => {
  let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});

const batteryIcon = (percent,ischarging) => {
	if(percent == 100 && ischarging) return 'battery-full-charged';
	if(percent >= 90 && ischarging) return 'battery-full-charging';
	if(percent >= 90) return 'battery-full';
	
	if(percent >= 70 && ischarging) return 'battery-good-charging';
	if(percent >= 70) return 'battery-good';
	
	if(percent >= 40 && ischarging) return 'battery-low-charging';
	if(percent >= 40) return 'battery-low';
	
	if(percent >= 20 && ischarging) return 'battery-caution-charging';
	if(percent >= 20) return 'battery-caution';
	
	if(percent == 0) return 'battery-empty';
	return 'battery';
};

const createBatteryDetailsDialog = (core,_) => {
	const hw = core.make('hw');
	core.make('osjs/dialogs').create({
		buttons: ['close'],
		window: { title: _('DIALOG_BATTERY_TITLE'), dimension: { width: 200, height: 400 }, icon: core.make('osjs/theme').icon('battery') }
	},dialog => null,(btn,value,dialog) => {}).render(async ($content,dialogWindow,dialog) => {
		dialog.app = app({
			battery: await hw.battery.get()
		},{},(state,actions) => dialog.createView([
			h(Box,{ grow: 1, padding: false },[
				h(BoxContainer,{},'hasbattery: '+state.battery.hasbattery),
				h(BoxContainer,{},'cyclecount: '+state.battery.cyclecount),
				h(BoxContainer,{},'maxcapacity: '+state.battery.maxcapacity),
				h(BoxContainer,{},'currentcapacity: '+state.battery.currentcapacity),
				h(BoxContainer,{},'percent: '+state.battery.percent),
				h(BoxContainer,{},'timeremaining: '+state.battery.timeremaining),
				h(BoxContainer,{},'acconnected: '+state.battery.acconnected),
				h(BoxContainer,{},'type: '+state.battery.type),
				h(BoxContainer,{},'model: '+state.battery.model),
				h(BoxContainer,{},'manufacturer: '+state.battery.manufacturer),
				h(BoxContainer,{},'serial: '+state.battery.serial)
			])
		]),$content);
		dialogWindow.on('dialog:button',() => dialog.destroy());
	});
};

const register = (core,args,options,metadata) => {
  const proc = core.make('osjs/application',{args,options,metadata});
  const {translatable} = core.make('osjs/locale');
  const _ = translatable(require('./locales.js'));
  try {
    const hw = core.make('hw');
    var intervals = [];
    hw.audio.getSinks().then(sinks => {
      let entries = [];
      const createEntry = sink => {
        let getVolume = () => sink.volume;
        let getLevel = () => {
          let vol = getVolume();
          if(vol <= 33) return 0;
          if(vol <= 66) return 1;
          return 2;
        };
        let entry = null;
        let menu = [
          { label: _('AUDIO_MUTE'), checked: sink.muted, onclick: ev => {
		        hw.audio.setSinkMute(sink.index,!ev.checked,(err,enabled) => {
		          if(err) return core.make('osjs/dialog','alert',{ message: err.message, title: err.name },(btn, value) => {});
		          menu[0].checked = sink.muted = ev.checked = enabled;
		          entry.update({
		            icon: core.make('osjs/theme').icon(!enabled ? [
		              'audio-volume-low',
		              'audio-volume-medium',
		              'audio-volume-high'
		            ][getLevel()] : 'audio-volume-muted')
              });
            });
          } },
          { element: () => h(RangeField,{
            min: 0,
            max: 100,
            value: sink.volume,
            onchange: ev => {
              sink.volume = ev.target.value;
		          entry.update({
		            icon: core.make('osjs/theme').icon(!sink.enabled ? [
		              'audio-volume-low',
		              'audio-volume-medium',
		              'audio-volume-high'
		            ][getLevel()] : 'audio-volume-muted')
              });
              hw.audio.setSinkVolumes(sink.index,sink.volume+'%').then(() => {
              }).catch(err => {
                core.make('osjs/dialog','alert',{ message: ex.message, title: ex.name },(btn, value) => {});
              });
            },
            oninput: value => {
              sink.volume = value;
		          entry.update({
		            icon: core.make('osjs/theme').icon(!sink.enabled ? [
		              'audio-volume-low',
		              'audio-volume-medium',
		              'audio-volume-high'
		            ][getLevel()] : 'audio-volume-muted')
              });
              hw.audio.setSinkVolumes(sink.index,sink.volume+'%').then(() => {
              }).catch(err => {
                core.make('osjs/dialog','alert',{ message: ex.message, title: ex.name },(btn, value) => {});
              });
            }
          },[]), closeable: false }
		    ];
		    entry = core.make('osjs/tray',{
		      icon: core.make('osjs/theme').icon(!sink.muted ? [
            'audio-volume-low',
            'audio-volume-medium',
            'audio-volume-high'
          ][getLevel()] : 'audio-volume-muted'),
		      title: sink.description,
		      onclick: ev => {
				    core.make('osjs/contextmenu').show({
				      position: ev.target,
				      menu: menu
				    });
		      }
		    });
        entries.push(entry);
		  };
		  for(let sink of sinks) createEntry(sink);
      proc.on('destroy',() => entries.forEach(entry => entry.destroy()));
		}).catch(err => {
      core.make('osjs/dialog','alert',{ message: ex.message, title: ex.name },(btn, value) => {});
		});
		hw.audio.getSources().then(sources => {
		  let entries = [];
		  const createEntry = source => {
		    let getSourceData = () => new Promise((resolve,reject) => {
		      hw.audio.pactl('list sources').then(output => {
		        let data = output.lines.slice(output.lines.indexOf('Source #'+source.index),output.lines.indexOf('',output.lines.indexOf('Source #'+source.index)));
		        if(data.length == 0) return reject(new Error('Failed to find source'));
		        resolve(data);
		      }).catch(reject);
		    });
		    let getVolume = () => source.volume;
		    let getType = () => source.name.split('.')[0].split('_')[1];
		    let isInput = () => getType() == 'input';
		    let isOutput = () => getType() == 'output';
		    const icons = [
          (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-low',
          (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-medium',
          (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-high'
        ];
        const mutedIcon = (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-muted';
		    let getLevel = () => {
		      let vol = getVolume();
		      if(vol <= 33) return 0;
		      if(vol <= 66) return 1;
		      return 2;
		    };
		    let entry = null;
		    let menu = [
		      { label: _('AUDIO_MUTE'), checked: source.muted, onclick: ev => {
		        hw.audio.setSourceMute(source.index,!ev.checked,(err,enabled) => {
		          if(err) return core.make('osjs/dialog','alert',{ message: err.message, title: err.name },(btn, value) => {});
		          menu[0].checked = source.muted = ev.checked = enabled;
		          entry.update({
		            icon: core.make('osjs/theme').icon(!enabled ? [
                  (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-low',
                  (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-medium',
                  (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-high'
                ][getLevel()] : (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-muted')
		          });
		        });
          } },
          { element: () => h(RangeField,{
            min: 0,
            max: 100,
            value: getVolume(),
            onchange: ev => {
              source.volume = ev.target.value;
		          entry.update({
		            icon: core.make('osjs/theme').icon(!source.enabled ? [
                  (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-low',
                  (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-medium',
                  (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-high'
                ][getLevel()] : (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-muted')
		          });
              hw.audio.setSourceVolumes(source.index,source.volume+'%').then(() => {
              }).catch(err => {
                core.make('osjs/dialog','alert',{ message: ex.message, title: ex.name },(btn, value) => {});
              });
            },
            oninput: value => {
              source.volume = value;
		          entry.update({
		            icon: core.make('osjs/theme').icon(!source.enabled ? [
                  (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-low',
                  (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-medium',
                  (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-high'
                ][getLevel()] : (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-muted')
		          });
              hw.audio.setSourceVolumes(source.index,source.volume+'%').then(() => {
              }).catch(err => {
                core.make('osjs/dialog','alert',{ message: ex.message, title: ex.name },(btn, value) => {});
              });
            }
          },[]), closeable: false }
		    ];
		    entry = core.make('osjs/tray',{
		      icon: core.make('osjs/theme').icon(!source.muted ? [
            (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-low',
            (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-medium',
            (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-high'
          ][getLevel()] : (isInput() ? 'microphone-sensitivity' : 'audio-volume')+'-muted'),
		      title: source.description,
		      onclick: ev => {
				    core.make('osjs/contextmenu').show({
				      position: ev.target,
				      menu: menu
				    });
		      }
		    });
        entries.push(entry);
		  };
		  for(let source of sources) createEntry(source);
      proc.on('destroy',() => entries.forEach(entry => entry.destroy()));
		}).catch(err => {
      core.make('osjs/dialog','alert',{ message: ex.message, title: ex.name },(btn, value) => {});
		});
		core.make('osjs/dbus').systemBus().then(dbus => {
	    const nmDevHandler = dev => ({
	      'BRIDGE': () => {},
	      'GENERIC': () => {},
	      'ETHERNET': () => {
	        const devIface = dbus.interface('org.freedesktop.NetworkManager',dev,'org.freedesktop.NetworkManager.Device.Wired');
	        let devStats = [];
	        let entry = null;
	        const setDevStats = props => {
	          devStats = [
	            { label: 'Speed: '+props.Speed+' Mb/s' }
	          ];
	          entry.update({
	            icon: props.Carrier ? core.make('osjs/theme').icon('network-wired') : core.make('osjs/theme').icon('network-wired-disconnected')
	          })
	        };
	        devIface.subscribe('PropertiesChanged',setDevStats);
          entry = core.make('osjs/tray',{
            title: _('DEV_ETH'),
            icon: core.make('osjs/theme').icon('network-wired'),
            onclick: async ev => {
				      core.make('osjs/contextmenu').show({
                position: ev.target,
                menu: devStats
				      });
            }
          });
	        devIface.props().then(setDevStats).catch(err => { throw err; });
          proc.on('destroy',() => entry.destroy());
	      },
	      'WIFI': () => {
	        const connect = ap => {
	          const apIface = dbus.interface('org.freedesktop.NetworkManager',ap,'org.freedesktop.NetworkManager.AccessPoint');
	          const settingsIface = dbus.interface('org.freedesktop.NetworkManager','/org/freedesktop/NetworkManager/Settings','org.freedesktop.NetworkManager.Settings');
	          apIface.props().then(async apProps => {
	            if(apProps.Flags & 0x00000001) {
	              core.make('osjs/dialog','prompt',{
	                message: _('DIALOG_WIFI_CONN_MSG'),
	                title: _('DIALOG_WIFI_CONN',apProps.Ssid)
	              },async (btn,value) => {
	                if(btn == 'ok') {
	                  const resp = await proc.request('/nmcli?args=device wifi connect \"'+apProps.Ssid+'\" password \"'+value+'\"',{ method: 'get' },null);
	                  const str = await resp.text();
	                  core.make('osjs/notification', {
	                    message: str.substr(4)
	                  });
	                }
	              });
	            } else {
	              const resp = await proc.request('/nmcli?args=device wifi connect \"'+apProps.Ssid+'\"',{ method: 'get' },null);
	              const str = await resp.text();
	              core.make('osjs/notification', {
                  message: str.substr(4)
	              });
	            }
	          }).catch(err => {
	            throw err;
	          });
	        };
	        let accessPoints = [];
	        let apPaths = {};
	        const devIface = dbus.interface('org.freedesktop.NetworkManager',dev,'org.freedesktop.NetworkManager.Device.Wireless');
	        let devStats = [];
	        let isConnected = false;
	        let entry = null;
	        const setDevStats = props => {
	          isConnected = props.ActiveAccessPoint.length > 1;
	          if(props.ActiveAccessPoint.length > 1) {
	            const apIface = dbus.interface('org.freedesktop.NetworkManager',props.ActiveAccessPoint,'org.freedesktop.NetworkManager.AccessPoint');
	            apIface.props().then(apProps => {
	              entry.update({
	                title: _('DEV_WIFI_CONNECTED',apProps.Ssid,apProps.Strength),
	                icon: core.make('osjs/theme').icon('network-idle')
	              });
	            }).catch(err => { throw err });
	          } else {
	            entry.update({
	              title: _('DEV_WIFI'),
	              icon: core.make('osjs/theme').icon('network-offline')
	            })
	          }
	          devStats = [
	            { label: 'Bitrate: '+props.Bitrate+' Kb/s' }
	          ];
	        };
	        devIface.subscribe('PropertiesChanged',setDevStats);
	        devIface.subscribe('AccessPointAdded',ap => {
	          const apIface = dbus.interface('org.freedesktop.NetworkManager',ap,'org.freedesktop.NetworkManager.AccessPoint');
	          apIface.props().then(apProps => {
	            if(accessPoints.length < 5 && accessPoints.indexOf(apProps.Ssid) == -1) {
	              accessPoints.push(apProps.Ssid);
	              apPaths[apProps.Ssid] = ap;
	            }
	          }).catch(err => {
	            throw err;
	          });
	        });
	        devIface.subscribe('AccessPointRemoved',ap => {
	          const apIface = dbus.interface('org.freedesktop.NetworkManager',ap,'org.freedesktop.NetworkManager.AccessPoint');
	          apIface.props().then(apProps => {
	            let i = accessPoints.indexOf(apProps.Ssid);
	            if(i > -1) accessPoints.splice(i,1);
              delete apPaths[apProps.Ssid];
	          }).catch(err => {
	            throw err;
	          });
	        });
	        devIface.call('GetAllAccessPoints').then(aps => {
	          for(let ap of aps) {
	            const apIface = dbus.interface('org.freedesktop.NetworkManager',ap,'org.freedesktop.NetworkManager.AccessPoint');
	            apIface.props().then(apProps => {
	              if(accessPoints.length < 5 && accessPoints.indexOf(apProps.Ssid) == -1) {
	                accessPoints.push(apProps.Ssid);
	                apPaths[apProps.Ssid] = ap;
	              }
	            }).catch(err => {
	              throw err;
	            });
	          }
	        }).catch(err => {
            throw err;
          });
          entry = core.make('osjs/tray',{
            title: _('DEV_WIFI'),
            icon: core.make('osjs/theme').icon('network-wireless'),
            onclick: async ev => {
				      core.make('osjs/contextmenu').show({
                position: ev.target,
                menu: [
                  ...accessPoints.map(label => ({ label, onclick: ev => connect(apPaths[label]) })),
                  { type: 'separator' },
                  ...devStats
                ]
				      });
            }
          });
	        devIface.props().then(setDevStats).catch(err => { throw err; });
          proc.on('destroy',() => entry.destroy());
	      }
	    });
		  const iface = dbus.interface('org.freedesktop.NetworkManager','/org/freedesktop/NetworkManager','org.freedesktop.NetworkManager');
		  iface.call('GetAllDevices').then(devs => {
		    for(let dev of devs) {
		      const devIface = dbus.interface('org.freedesktop.NetworkManager',dev,'org.freedesktop.NetworkManager.Device');
		      devIface.props().then(props => {
		        let type = NM_DEVICE_TYPE[props.DeviceType];
		        console.log('Found a '+type+' device at \"'+dev+'\"');
		        let devHandler = nmDevHandler(dev)[type];
		        if(devHandler) devHandler();
		        else core.make('osjs/dialog','alert',{ message: _('DEV_MISSING',type) },(btn, value) => {});
		      }).catch(err => {
		        throw err;
		      });
		    }
		  }).catch(err => {
		    core.make('osjs/dialog','alert',{ message: ex.message, title: ex.name },(btn, value) => {});
		  });
		}).catch(err => {
      core.make('osjs/dialog','alert',{ message: ex.message, title: ex.name },(btn, value) => {});
    });
		hw.battery.get().then(bat => {
			if(bat.hasbattery) {
				var entry = core.make('osjs/tray',{
					title: _('ITEM_BATTERY_CHARGE',bat.percent),
					icon: core.make('osjs/theme').icon(batteryIcon(bat.percent,bat.ischarging)),
					onclick: async ev => {
						const battery = await hw.battery.get();
						core.make('osjs/contextmenu').show({
							position: ev.target,
							menu: [
								{ label: _('ITEM_BATTERY_CHARGE',battery.percent) },
								{ label: _('ITEM_BATTERY_TIME',strftime('%H:%M',new Date(battery.timeremaining*1000))) },
								{ label: _('ITEM_DETAILS'), onclick: () => createBatteryDetailsDialog(core,_) }
							]
						});
					}
				});
				var shouldAlert = true;
				intervals.push(setInterval(async () => {
					const battery = await hw.battery.get();
					if(battery.percent <= 20 && shouldAlert) {
						core.make('osjs/notification',{
							message: _('NOTIF_BATTERY_LOW'),
							icon: core.make('osjs/theme').icon(batteryIcon(battery.percent,battery.ischarging))
						});
						shouldAlert = false;
					} else shouldAlert = true;
					entry.update({
						title: _('ITEM_BATTERY_CHARGE',battery.percent),
						icon: core.make('osjs/theme').icon(batteryIcon(battery.percent,battery.ischarging))
					});
				},1000));
				proc.on('destroy',() => entry.destroy());
			}
		}).catch(err => {
			core.make('osjs/dialog','alert',{ message: ex.message, title: ex.name },(btn, value) => {});
		});
		proc.on('destroy',() => {
			for(var int of intervals) clearInterval(int);
		});
	} catch(ex) {
		core.make('osjs/dialog','alert',{ message: ex.message, title: ex.name },(btn, value) => {});
	}
	return proc;
};
osjs.register(applicationName,register);
