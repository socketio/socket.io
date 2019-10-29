module.exports = {
	apps: [{
		name: 'multi-process-chat',
		script: './index.js',
		instances: 0,
		exec_mode: 'cluster'
	}]
}
