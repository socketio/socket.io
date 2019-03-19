const Benchmark = require('benchmark');
const suite = new Benchmark.Suite;

const parser = require('..');

suite
    .add('encode packet as string', (deferred) => {
        parser.encodePacket({ type: 'message', data: 'test' }, true, () => {
            deferred.resolve();
        });
    }, { defer: true })
    .add('encode packet as binary', (deferred) => {
        parser.encodePacket({ type: 'message', data: Buffer.from([1, 2, 3, 4]) }, true, () => {
            deferred.resolve();
        });
    }, { defer: true })
    .add('encode payload as string', (deferred) => {
        parser.encodePayload([{ type: 'message', data: 'test1' }, { type: 'message', data: 'test2' }], true, () => {
            deferred.resolve();
        });
    }, { defer: true })
    .add('encode payload as binary', (deferred) => {
        parser.encodePayload([{ type: 'message', data: 'test' }, { type: 'message', data: Buffer.from([1, 2, 3, 4]) }], true, () => {
            deferred.resolve();
        })
    }, { defer: true })
    .add('decode packet from string', () => {
        parser.decodePacket('4test');
    })
    .add('decode packet from binary', () => {
        parser.decodePacket(Buffer.from([4, 1, 2, 3, 4]));
    })
    .add('decode payload from string', (deferred) => {
        let i = 0;
        parser.decodePayload('6:4test16:4test2', () => {
            if (++i === 2) deferred.resolve();
        })
    }, { defer: true })
    .add('decode payload from binary', (deferred) => {
        let i = 0;
        parser.decodePayload(Buffer.from([0x00, 0x05, 0xff, 0x34, 0x74, 0x65, 0x73, 0x74, 0x01, 0x05, 0xff, 0x04, 0x01, 0x02, 0x03, 0x04]), () => {
            if (++i === 1) deferred.resolve();
        })
    }, { defer: true })
    .on('cycle', function(event) {
        console.log(String(event.target));
    })
    .on('complete', function() {
        console.log('Fastest is ' + this.filter('fastest').map('name'));
    })
    .run({ 'async': true });
