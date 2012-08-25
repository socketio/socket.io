
0.6.1 / 2012-06-01 
==================

  * Added: append (yes or no) on confirmation
  * Added: allow node.js v0.7.x

0.6.0 / 2012-04-10 
==================

  * Added `.prompt(obj, callback)` support. Closes #49
  * Added default support to .choose(). Closes #41
  * Fixed the choice example

0.5.1 / 2011-12-20 
==================

  * Fixed `password()` for recent nodes. Closes #36

0.5.0 / 2011-12-04 
==================

  * Added sub-command option support [itay]

0.4.3 / 2011-12-04 
==================

  * Fixed custom help ordering. Closes #32

0.4.2 / 2011-11-24 
==================

  * Added travis support
  * Fixed: line-buffered input automatically trimmed. Closes #31

0.4.1 / 2011-11-18 
==================

  * Removed listening for "close" on --help

0.4.0 / 2011-11-15 
==================

  * Added support for `--`. Closes #24

0.3.3 / 2011-11-14 
==================

  * Fixed: wait for close event when writing help info [Jerry Hamlet]

0.3.2 / 2011-11-01 
==================

  * Fixed long flag definitions with values [felixge]

0.3.1 / 2011-10-31 
==================

  * Changed `--version` short flag to `-V` from `-v`
  * Changed `.version()` so it's configurable [felixge]

0.3.0 / 2011-10-31 
==================

  * Added support for long flags only. Closes #18

0.2.1 / 2011-10-24 
==================

  * "node": ">= 0.4.x < 0.7.0". Closes #20

0.2.0 / 2011-09-26 
==================

  * Allow for defaults that are not just boolean. Default peassignment only occurs for --no-*, optional, and required arguments. [Jim Isaacs]

0.1.0 / 2011-08-24 
==================

  * Added support for custom `--help` output

0.0.5 / 2011-08-18 
==================

  * Changed: when the user enters nothing prompt for password again
  * Fixed issue with passwords beginning with numbers [NuckChorris]

0.0.4 / 2011-08-15 
==================

  * Fixed `Commander#args`

0.0.3 / 2011-08-15 
==================

  * Added default option value support

0.0.2 / 2011-08-15 
==================

  * Added mask support to `Command#password(str[, mask], fn)`
  * Added `Command#password(str, fn)`

0.0.1 / 2010-01-03
==================

  * Initial release
