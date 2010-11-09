#!/usr/bin/python
# Usage: pgomerge.py <binary basename> <dist/bin>
# Gathers .pgc files from dist/bin and merges them into
# $PWD/$basename.pgd using pgomgr, then deletes them.
# No errors if any of these files don't exist.

import sys, os, os.path, subprocess
if not sys.platform == "win32":
    raise Exception("This script was only meant for Windows.")

def MergePGOFiles(basename, pgddir, pgcdir):
  """Merge pgc files produced from an instrumented binary
     into the pgd file for the second pass of profile-guided optimization
     with MSVC.  |basename| is the name of the DLL or EXE without the
     extension.  |pgddir| is the path that contains <basename>.pgd
     (should be the objdir it was built in).  |pgcdir| is the path
     containing basename!N.pgc files, which is probably dist/bin.
     Calls pgomgr to merge each pgc file into the pgd, then deletes
     the pgc files."""
  if not os.path.isdir(pgddir) or not os.path.isdir(pgcdir):
    return
  pgdfile = os.path.abspath(os.path.join(pgddir, basename + ".pgd"))
  if not os.path.isfile(pgdfile):
    return
  for file in os.listdir(pgcdir):
    if file.startswith(basename) and file.endswith(".pgc"):
      try:
        pgcfile = os.path.normpath(os.path.join(pgcdir, file))
        subprocess.call(['pgomgr', '-merge',
                         pgcfile,
                         pgdfile])
        os.remove(pgcfile)
      except OSError:
        pass

if __name__ == '__main__':
  if len(sys.argv) != 3:
      print >>sys.stderr, "Usage: pgomerge.py <binary basename> <dist/bin>"
      sys.exit(1)
  MergePGOFiles(sys.argv[1], os.getcwd(), sys.argv[2])
