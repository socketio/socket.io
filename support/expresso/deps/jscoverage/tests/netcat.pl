use strict;
use warnings;

use Socket;

binmode(STDIN);
$| = 1;
binmode(STDOUT);

if (@ARGV != 2) {
  die "Usage: netcat.pl HOST PORT\n";
}

my $host = shift;
my $port = shift;

my $address = inet_aton($host) or die;
my $address_and_port = sockaddr_in($port, $address);
my $protocol = getprotobyname('tcp');
socket(SOCKET, PF_INET, SOCK_STREAM, $protocol) or die;

my $old = select(SOCKET);
$| = 1;
select($old);
binmode(SOCKET);

connect(SOCKET, $address_and_port) or die;
while (<STDIN>) {
  print SOCKET $_;
}
while (<SOCKET>) {
  print;
}
close(SOCKET);
exit 0;