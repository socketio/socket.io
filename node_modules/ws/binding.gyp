{
  'targets': [
    {
      'target_name': 'validation',
      'cflags': [ '-O3' ],
      'sources': [ 'src/validation.cc' ]
    },
    {
      'target_name': 'bufferutil',
      'cflags': [ '-O3' ],
      'sources': [ 'src/bufferutil.cc' ]
    }
  ]
}
