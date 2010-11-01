# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Mozilla.
#
# The Initial Developer of the Original Code is
# the Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2007
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Axel Hecht <axel@pike.org>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

# This is a partial python port of nsinstall.
# It's intended to be used when there's no natively compile nsinstall
# available, and doesn't intend to be fully equivalent.
# Its major use is for l10n repackaging on systems that don't have
# a full build environment set up.
# The basic limitation is, it doesn't even try to link and ignores
# all related options.

from optparse import OptionParser
import os
import os.path
import sys
import shutil

usage = "usage: %prog [options] arg1 [arg2 ...] target-directory"
p = OptionParser(usage=usage)

p.add_option('-D', action="store_true",
             help="Create a single directory only")
p.add_option('-t', action="store_true",
             help="Preserve time stamp")
p.add_option('-m', action="store",
             help="Set mode", metavar="mode")
p.add_option('-d', action="store_true",
             help="Create directories in target")
p.add_option('-R', action="store_true",
             help="Use relative symbolic links (ignored)")
p.add_option('-l', action="store_true",
             help="Create link (ignored)")
p.add_option('-L', action="store", metavar="linkprefix",
             help="Link prefix (ignored)")

# The remaining arguments are not used in our tree, thus they're not
# implented.
def BadArg(option, opt, value, parser):
  parser.error('option not supported: %s' % opt)

p.add_option('-C', action="callback", metavar="CWD",
             callback=BadArg,
             help="NOT SUPPORTED")
p.add_option('-o', action="callback", callback=BadArg,
             help="Set owner (NOT SUPPORTED)", metavar="owner")
p.add_option('-g', action="callback", callback=BadArg,
             help="Set group (NOT SUPPORTED)", metavar="group")

(options, args) = p.parse_args()

if options.m:
  # mode is specified
  try:
    options.m = int(options.m, 8)
  except:
    sys.stderr.write('nsinstall: ' + options.m + ' is not a valid mode\n')
    sys.exit(1)

# just create one directory?
if options.D:
  if len(args) != 1:
    sys.exit(1)
  if os.path.exists(args[0]):
    if not os.path.isdir(args[0]):
      sys.stderr.write('nsinstall: ' + args[0] + ' is not a directory\n')
      sys.exit(1)
    if options.m:
      os.chmod(args[0], options.m)
    sys.exit()
  if options.m:
    os.makedirs(args[0], options.m)
  else:
    os.makedirs(args[0])
  sys.exit()

# nsinstall arg1 [...] directory
if len(args) < 2:
  p.error('not enough arguments')

# set up handler
if options.d:
  # we're supposed to create directories
  def handleTarget(srcpath, targetpath):
    # target directory was already created, just use mkdir
    os.mkdir(dest)
else:
  # we're supposed to copy files
  def handleTarget(srcpath, targetpath):
    if options.t:
      shutil.copy2(srcpath, targetpath)
    else:
      shutil.copy(srcpath, targetpath)

# the last argument is the target directory
target = args.pop()
# ensure target directory
if not os.path.isdir(target):
  os.makedirs(target)

for f in args:
  dest = os.path.join(target,
                      os.path.basename(os.path.normpath(f)))
  handleTarget(f, dest)
  if options.m:
    os.chmod(dest, options.m)
