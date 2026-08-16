export class Subject {
    constructor() {
        this._subscribers = new Set();
    }

    subscribe(callback) {
        this._subscribers.add(callback);
        return () => this._subscribers.delete(callback);
    }

    next(value) {
        this._subscribers.forEach((callback) => callback(value));
    }
}
