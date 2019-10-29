module.exports = {
	apps: [{
		name: 'multi-process-chat',
		script: './index.js',
		instances: 4,
		exec_mode: 'cluster'
	}]
}
