# check-sync-dirs.py --- check that one directory is an exact subset of another
#
# Usage: python check-sync-dirs.py COPY ORIGINAL
#
# Check that the files present in the directory tree COPY are exact
# copies of their counterparts in the directory tree ORIGINAL.  COPY
# need not have all the files in ORIGINAL, but COPY may not have files
# absent from ORIGINAL.
# 
# Each directory in COPY may have a file named
# 'check-sync-exceptions', which lists files in COPY that need not be
# the same as the corresponding file in ORIGINAL, or exist at all in
# ORIGINAL.  (The 'check-sync-exceptions' file itself is always
# treated as exceptional.)  Blank lines and '#' comments in the file
# are ignored.

import sys
import os
from os.path import join
import filecmp
import textwrap
import fnmatch

if len(sys.argv) != 3:
    print >> sys.stderr, "Usage: %s COPY ORIGINAL" % sys.argv[0]
    sys.exit(1)

copy = sys.argv[1]
original = sys.argv[2]

# Ignore detritus left lying around by editing tools.
ignored_patterns = ['*~', '.#*', '#*#', '*.orig', '*.rej']

# Return the contents of FILENAME, a 'check-sync-exceptions' file, as
# a dictionary whose keys are exactly the list of filenames, along
# with the basename of FILENAME itself.  If FILENAME does not exist,
# return the empty dictionary.
def read_exceptions(filename):
    if (os.path.exists(filename)):
        f = file(filename)
        exceptions={}
        for line in f:
            line = line.strip()
            if line != '' and line[0] != '#':
                exceptions[line] = None
        exceptions[os.path.basename (filename)] = None
        f.close()
        return exceptions
    else:
        return {}

# Return true if FILENAME matches any pattern in the list of filename
# patterns PATTERNS.
def fnmatch_any(filename, patterns):
    for pattern in patterns:
        if fnmatch.fnmatch(filename, pattern):
            return True
    return False

# Check the contents of the directory tree COPY against ORIGINAL.  For each
# file that differs, apply REPORT to COPY, ORIGINAL, and the file's
# relative path.  COPY and ORIGINAL should be absolute.  Ignore files 
# that match patterns given in the list IGNORE.
def check(copy, original, ignore, report):
    os.chdir(copy)
    for (dirpath, dirnames, filenames) in os.walk('.'):
        exceptions = read_exceptions(join(dirpath, 'check-sync-exceptions'))
        for filename in filenames:
            if filename in exceptions:
                continue
            if fnmatch_any(filename, ignore):
                continue
            relative_name = join(dirpath, filename)
            original_name = join(original, relative_name)
            if (os.path.exists(original_name)
                and filecmp.cmp(relative_name, original_name)):
                continue
            report(copy, original, relative_name)


differences_found = False

# Print an error message for DIFFERING, which was found to differ
# between COPY and ORIGINAL.  Set the global variable differences_found.
def report(copy, original, differing):
    global differences_found
    if not differences_found:
        print >> sys.stderr, "TEST-FAIL | build file copies are not in sync"
        print >> sys.stderr, "file(s) found in:               %s" % (copy)
        print >> sys.stderr, ("differ from their originals in: %s"
                              % (original))
    print >> sys.stderr, "file differs: %s" % (differing)
    differences_found = True

check(os.path.abspath(copy),
      os.path.abspath(original),
      ignored_patterns,
      report)

if differences_found:
    msg=('''In general, the files in '%s' should always be exact copies of
originals in '%s'.  A change made to one should also be made to the
other.  See 'check-sync-dirs.py' for more details.'''
         % (copy, original))
    print >> sys.stderr, textwrap.fill(msg, 75)
    sys.exit(1)

sys.exit(0)
