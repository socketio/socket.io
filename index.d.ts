interface Emitter<Event = string> {
    on(event: Event, listener: Function): Emitter;
    once(event: Event, listener: Function): Emitter;
    off(event?: Event, listener?: Function): Emitter;
    emit(event: Event, ...args: any[]): Emitter;
    listeners(event: Event): Function[];
    hasListeners(event: Event): boolean;
    removeListener(event?: Event, listener?: Function): Emitter;
    removeEventListener(event?: Event, listener?: Function): Emitter;
    removeAllListeners(event?: Event): Emitter;
}

declare const Emitter: {
    (obj?: object): Emitter;
    new (obj?: object): Emitter;
};

export default Emitter;
