use strict;
use warnings;

use HTTP::Daemon;
use HTTP::Status;

$|++;

my $d = HTTP::Daemon->new(LocalPort => 8000, ReuseAddr => 1) || die;
print "Please contact me at: <URL:", $d->url, ">\n";
my $done = 0;
while (not $done and my $c = $d->accept) {
  my $r = $c->get_request;
  if (not defined($r)) {
    print "Error: ", $c->reason, "\n";
    $c->close;
    undef($c);
    next;
  }
  print STDERR $r->method, ' ', $r->url, "\n";
  $c->force_last_request;
  if ($r->method eq 'GET') {
    my $file = substr($r->url->path, 1);
    if (open FILE, $file) {
      undef $/;
      binmode FILE;
      my $content = <FILE>;
      close FILE;
      my @headers = ('Connection' => 'close');
      if ($file =~ /\.js$/) {
        push @headers, 'Content-Type' => 'text/javascript';
      }
      elsif ($file =~ /\.[^\/]+$/) {
        push @headers, 'Content-Type' => 'application/octet-stream';
      }
      else {
        # do nothing - no Content-Type
      }
      my $response = HTTP::Response->new(200, 'OK', \@headers, $content);
      $c->send_response($response);
    }
    else {
      my $response = HTTP::Response->new(404, 'Not found', ['Connection' => 'close'], 'Not found');
      $c->send_response($response);
    }
  }
  elsif ($r->method eq 'POST') {
    if ($r->url->path eq '/perl-shutdown') {
      $done = 1;
    }
    my $content = $r->content;
    my $response = HTTP::Response->new(200, 'OK', ['Connection' => 'close'], $content);
    $c->send_response($response);
  }
  else {
    $c->send_error(RC_FORBIDDEN);
  }
  $c->close;
  undef($c);
}

