const child_process = require('child_process');

module.exports = (core,proc) => ({
	init: async () => {
	  core.app.get(proc.resource('/nmcli'),(req,res) => {
	    res.type('text').send(child_process.execSync('nmcli '+req.query.args));
	  });
	},
	start: () => {},
	destroy: () => {},
});
