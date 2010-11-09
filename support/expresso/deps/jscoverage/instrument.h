/*
    instrument.h - file and directory instrumentation routines
    Copyright (C) 2007, 2008 siliconforks.com

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

#ifndef INSTRUMENT_H_
#define INSTRUMENT_H_

void jscoverage_instrument(const char * source,
                           const char * destination,
                           int verbose,
                           char ** exclude,
                           int num_exclude,
                           char ** no_instrument,
                           int num_no_instrument);

#endif /* INSTRUMENT_H_ */
