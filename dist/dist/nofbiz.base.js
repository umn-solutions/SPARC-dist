const {c: cloneDeep, u: uniqueId, f: forEach, d: debounce, s: some, m: map, t: throttle, r: reduce, o: orderBy, e: every} = await import("./dependencies/lodash.js").catch(() => {
    throw new Error("[SPARC] Required vendor file not found: dependencies/lodash.js");
});

const {l: __lodash} = await import("./dependencies/lodash.js").catch(() => {
    throw new Error("[SPARC] Required vendor file not found: dependencies/lodash.js");
});

export { __lodash };

const {z: __zod} = await import("./dependencies/zod.js").catch(() => {
    throw new Error("[SPARC] Required vendor file not found: dependencies/zod.js");
});

export { __zod };

const {d: dayjs, c: customParseFormat} = await import("./dependencies/dayjs.js").catch(() => {
    throw new Error("[SPARC] Required vendor file not found: dependencies/dayjs.js");
});

const {F: Fuse} = await import("./dependencies/fuse.js").catch(() => {
    throw new Error("[SPARC] Required vendor file not found: dependencies/fuse.js");
});

const {v: v4} = await import("./dependencies/uuid.js").catch(() => {
    throw new Error("[SPARC] Required vendor file not found: dependencies/uuid.js");
});

const {S: StartToastifyInstance} = await import("./dependencies/toastify.js").catch(() => {
    throw new Error("[SPARC] Required vendor file not found: dependencies/toastify.js");
});

function isPrimitive(value) {
    return value === null || value === undefined || typeof value !== "object";
}

class FormField {
    constructor(props) {
        this._value = props?.value !== undefined && props?.value !== null ? isPrimitive(props.value) ? props.value : cloneDeep(props.value) : "";
        this._isValid = false;
        this._isValidating = false;
        this._wasTouched = false;
        this._isDisposed = false;
        this._subscribers = new Set;
        this._validatorCallback = props?.validatorCallback;
    }
    get [Symbol.toStringTag]() {
        return "Form Field";
    }
    [Symbol.toPrimitive]() {
        return this.toString();
    }
    toString() {
        if (Array.isArray(this._value)) {
            return this._value.map(e => e.label).join(", ");
        }
        if (typeof this._value === "object" && this._value !== null && "label" in this._value) {
            return this._value.label;
        }
        return this._value;
    }
    validate() {
        if (typeof this?._validatorCallback !== "function") return null;
        const result = this._validatorCallback(this._value);
        if (result !== null && typeof result === "object" && typeof result.then === "function") {
            console.warn("[FormField.validate] validator is async but validate() was called synchronously.", "Call validateAsync() instead to get a real boolean result.", {
                field: this
            });
            return null;
        }
        this._isValid = result;
        return this._isValid;
    }
    async validateAsync() {
        if (typeof this._validatorCallback !== "function") return null;
        const result = this._validatorCallback(this._value);
        if (typeof result === "boolean") {
            this._isValid = result;
            return result;
        }
        this._isValidating = true;
        this._notify();
        try {
            this._isValid = await result;
            return this._isValid;
        } finally {
            this._isValidating = false;
            this._notify();
        }
    }
    focusOnInput() {
        if (!this._inputSelector) return;
        $(this._inputSelector).trigger("focus");
    }
    set value(data) {
        if (data === this._value) return;
        this._value = isPrimitive(data) ? data : cloneDeep(data);
        this._wasTouched = true;
        this._notify();
    }
    set inputSelector(selector) {
        if (this._validatorCallback) this._inputSelector = selector;
    }
    get value() {
        return this._value;
    }
    get wasTouched() {
        return this._wasTouched;
    }
    get isValid() {
        return this._isValid;
    }
    get isValidating() {
        return this._isValidating;
    }
    get hasValidation() {
        return typeof this._validatorCallback === "function";
    }
    get isDisposed() {
        return this._isDisposed;
    }
    subscribe(callback) {
        if (this._isDisposed) return () => {};
        this._subscribers.add(callback);
        return () => {
            this._subscribers.delete(callback);
        };
    }
    _notify() {
        if (this._isDisposed) return;
        for (const subscriber of this._subscribers) {
            try {
                subscriber(this._value);
            } catch (error) {
                console.error("[FormField._notify] subscriber threw", error);
            }
        }
    }
    dispose() {
        this._subscribers.clear();
        this._isDisposed = true;
    }
}

const LIB_PREFIX = "nofbiz";

const generateRuntimeUID = prefix => uniqueId(prefix);

const generateUUIDv4 = v4;

function isHTMDComponent(arg) {
    if (typeof arg === "object" && arg !== null) {
        return arg?.isHTMD;
    } else return false;
}

class HTMDElement {
    constructor(children, props = {}) {
        this._eventsMap = {};
        this._managedListeners = new Map;
        this._id = props?.id || generateRuntimeUID(`${LIB_PREFIX}-element`);
        this._name = new.target.name.toLowerCase();
        this._class = "";
        this.class = props?.class || "";
        this._containerSelector = props?.containerSelector || "";
        this._children = children;
        this.isHTMD = true;
    }
    get [Symbol.toStringTag]() {
        return this._name;
    }
    setEventHandler(eventName, callback) {
        if (!callback) return;
        this._eventsMap[eventName] = callback;
        this.instance?.off(eventName);
        this.instance?.on(eventName, e => callback(e.originalEvent));
    }
    _applyEventListeners() {
        for (const [event, callback] of Object.entries(this._eventsMap)) {
            if (callback) {
                this.instance?.off(event);
                this.instance?.on(event, e => {
                    const nativeEvent = e.originalEvent;
                    if (nativeEvent) {
                        callback(nativeEvent);
                    }
                });
            }
        }
    }
    clearEventListenersRecord(eventsList) {
        const list = eventsList ? eventsList : Object.keys(this._eventsMap);
        for (const event of list) {
            delete this._eventsMap[event];
            this.instance?.off(event);
        }
    }
    clearAllEventListenersAndRecords() {
        this._eventsMap = {};
        this.removeAllEventListeners();
    }
    removeEventListeners(eventsList) {
        const list = eventsList ? eventsList : Object.keys(this._eventsMap);
        for (const event of list) {
            this.instance?.off(event);
        }
    }
    removeAllEventListeners() {
        this.instance?.find("*").addBack().off();
    }
    _hashSelector(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) h = h * 31 + s.charCodeAt(i) | 0;
        return (h >>> 0).toString(36);
    }
    _managedNs(event, selector) {
        const tag = selector ? "s" + this._hashSelector(selector) : "root";
        return `${event}.sparc-${this._id}-${tag}`;
    }
    _addManagedListener(event, handler, selector) {
        const key = selector ? `${event}|${selector}` : event;
        const ns = this._managedNs(event, selector);
        const prior = this._managedListeners.get(key);
        if (prior) {
            this.instance?.off(ns);
        }
        this._managedListeners.set(key, handler);
        if (selector) {
            this.instance?.on(ns, selector, handler);
        } else {
            this.instance?.on(ns, handler);
        }
    }
    _applyManagedListeners() {
        for (const [key, handler] of this._managedListeners) {
            const pipeIdx = key.indexOf("|");
            const event = pipeIdx === -1 ? key : key.slice(0, pipeIdx);
            const selector = pipeIdx === -1 ? undefined : key.slice(pipeIdx + 1);
            const ns = this._managedNs(event, selector);
            if (selector) {
                this.instance?.on(ns, selector, handler);
            } else {
                this.instance?.on(ns, handler);
            }
        }
    }
    _removeChild(child) {
        if (isHTMDComponent(child)) {
            child.remove();
        } else if (typeof child === `function`) {
            this._removeChild(child());
        }
    }
    _removeChildren(children) {
        if (Array.isArray(children)) {
            forEach(children, child => this._removeChildren(child));
        } else {
            this._removeChild(children);
        }
    }
    remove() {
        if (this.class.includes("trace-lifecycle")) console.trace(`REMOVING ${this._name} with id ${this._id}`);
        if (!this.isAlive) return;
        this.removeAllEventListeners();
        this._removeChildren(this._children);
        this.instance?.remove();
    }
    render(shouldRenderChildren = true, childrenOptions) {
        if (this.class.includes("trace-lifecycle")) console.trace(`RENDERING ${this._name} with id ${this._id}`);
        if (this.isAlive) {
            this._refresh(shouldRenderChildren, childrenOptions);
            return;
        }
        $(this._containerSelector).append(this.toString());
        this._applyEventListeners();
        if (shouldRenderChildren) this._renderChildren(this._children, childrenOptions);
    }
    _refresh(shouldRenderChildren = true, childrenOptions) {
        if (shouldRenderChildren) this._removeChildren(this._children);
        this.instance?.replaceWith(this.toString());
        this.removeEventListeners();
        this._applyEventListeners();
        this._applyManagedListeners();
        if (shouldRenderChildren) this._renderChildren(this._children, childrenOptions);
    }
    _renderChild(child, options) {
        if (isHTMDComponent(child)) {
            child.containerSelector = `${this.selector} ${options?.childrenContainerSelector ?? ""}`;
            child.render();
        } else if (typeof child === `function`) {
            this._renderChild(child(), options);
            return;
        } else {
            if (options?.childrenContainerSelector) {
                this.instance?.find(options?.childrenContainerSelector)?.append(child);
            } else {
                this.instance?.append(child);
            }
        }
    }
    _renderChildren(children = this._children, options) {
        if (!children) return; else if (Array.isArray(children)) {
            forEach(children, child => child && this._renderChildren(child, options));
        } else {
            this._renderChild(children, options);
        }
    }
    get instance() {
        return this.isAlive ? $(this.selector) : null;
    }
    get selector() {
        return `${this._containerSelector ?? ""} #${this.id}.${this.topClassBEM}`;
    }
    get isAlive() {
        return $(this.selector).length === 1;
    }
    get topClassBEM() {
        return `${LIB_PREFIX}__${this.name}`;
    }
    get id() {
        return this._id;
    }
    set class(classList) {
        this._class = `${LIB_PREFIX}__${this.name}${classList ? ` ${classList}` : ""}`;
    }
    get class() {
        return this._class;
    }
    get name() {
        return this._name;
    }
    set containerSelector(selector) {
        if (this.containerSelector === selector) return;
        this.remove();
        this._containerSelector = selector;
    }
    get containerSelector() {
        return this._containerSelector;
    }
    set children(children) {
        this._children = children;
        this._refresh();
    }
    get children() {
        return this._children;
    }
}

class FormControl extends HTMDElement {
    constructor(fieldOrValue, props = {}) {
        super(undefined, props);
        this._validationModifier = "";
        if (fieldOrValue instanceof FormField) {
            this._value = fieldOrValue;
            this._value.inputSelector = this.selector;
            this._ownsFormField = false;
        } else {
            this._value = new FormField({
                value: fieldOrValue
            });
            this._ownsFormField = true;
        }
        this._isDisabled = props?.isDisabled || false;
        this._isLoading = props?.isLoading || false;
        this.title = props?.title || "";
    }
    get _validationClass() {
        if (this._value.hasValidation && this._value.wasTouched) return this._value.isValid ? "form-control--valid" : "form-control--invalid"; else return "";
    }
    _validate() {
        if (!this.instance) return;
        if (this._validationModifier) {
            this.instance.removeClass(this._validationModifier);
        }
        this._value.validate();
        const newModifier = this._validationClass;
        this._validationModifier = newModifier;
        if (newModifier) {
            this.instance.addClass(newModifier);
        }
    }
    toggleDisabledState() {
        if (!this.isAlive) return;
        this._isDisabled = !this._isDisabled;
        this.render();
    }
    toggleLoadingState() {
        if (!this.isAlive) return;
        this._isLoading = !this._isLoading;
        this.render();
    }
    get modifierClasses() {
        let mods = [];
        const prefix = "form-control--";
        if (this._isDisabled) mods.push(prefix + "disabled");
        if (this._isLoading) mods.push(prefix + "loading");
        return mods.join(" ");
    }
    remove() {
        if (this._ownsFormField) {
            this._value.dispose();
        }
        super.remove();
    }
    set class(str) {
        super.class = `form-control${str ? ` ${str}` : ""}`;
    }
    get class() {
        return super.class;
    }
    get isValid() {
        return this._value.isValid;
    }
    get wasTouched() {
        return this._value.wasTouched;
    }
    get value() {
        return this._value;
    }
    set isDisabled(flag) {
        if (!this.isAlive) return;
        this._isDisabled = flag;
        this.render();
    }
    get isDisabled() {
        return this._isDisabled;
    }
    set isLoading(flag) {
        if (!this.isAlive) return;
        this._isLoading = flag;
        this.render();
    }
    get isLoading() {
        return this._isLoading;
    }
}

class DebouncedInput extends FormControl {
    constructor(fieldOrValue, props = {}) {
        super(fieldOrValue, props);
        this._debouncedSync = debounce(() => this._syncValue(), props?.debounceMs ?? 300);
    }
    _onInput() {}
    _applyEventListeners() {
        super._applyEventListeners();
        this.setEventHandler("input", () => {
            this._debouncedSync();
            this._onInput();
        });
        this.setEventHandler("blur", () => {
            this._debouncedSync.cancel();
            this._syncValue();
        });
    }
    remove() {
        this._debouncedSync.cancel();
        super.remove();
    }
}

class SystemError extends Error {
    constructor(name, message, options) {
        super(message);
        this._name = name;
        this._timestamp = new Date;
        this._breaksFlow = options?.breaksFlow ?? true;
        this.cause = options?.cause;
    }
    static fromErrorEvent(event, options = {
        breaksFlow: true
    }) {
        const error = event.error;
        if (error instanceof SystemError) {
            return error;
        }
        let sysError;
        if (error?.constructor !== Error) {
            sysError = new SystemError(error?.name ?? "UnknownError", error?.message ?? "", {
                ...options,
                cause: error
            });
        } else {
            sysError = new SystemError("UndefinedError", error.message, {
                ...options,
                cause: error
            });
        }
        sysError.stack = error.stack;
        return sysError;
    }
    get timestamp() {
        return this._timestamp;
    }
    get name() {
        return this._name;
    }
    get breaksFlow() {
        return this._breaksFlow;
    }
    toString() {
        const causeStr = this.cause != null ? ` --- caused by --- ${this.cause instanceof Error ? this.cause.stack ?? String(this.cause) : String(this.cause)}` : "";
        return `${this._name}: ${this.message} --- stack trace --- ${this.stack}${causeStr}`;
    }
    toJSON() {
        return JSON.stringify({
            name: this.name,
            message: this.message,
            timestamp: this.timestamp,
            stack: this.stack,
            cause: this.cause instanceof Error ? {
                name: this.cause.name,
                message: this.cause.message,
                stack: this.cause.stack
            } : this.cause != null ? String(this.cause) : undefined
        }, null, 2);
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const escapeAttr = escapeHtml;

var accountCircleFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C17.52 2 22 6.48 22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2ZM6.02332 15.4163C7.49083 17.6069 9.69511 19 12.1597 19C14.6243 19 16.8286 17.6069 18.2961 15.4163C16.6885 13.9172 14.5312 13 12.1597 13C9.78821 13 7.63095 13.9172 6.02332 15.4163ZM12 11C13.6569 11 15 9.65685 15 8C15 6.34315 13.6569 5 12 5C10.3431 5 9 6.34315 9 8C9 9.65685 10.3431 11 12 11Z"/></svg>';

var accountCircleLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM12.1597 16C10.1243 16 8.29182 16.8687 7.01276 18.2556C8.38039 19.3474 10.114 20 12 20C13.9695 20 15.7727 19.2883 17.1666 18.1081C15.8956 16.8074 14.1219 16 12.1597 16ZM12 4C7.58172 4 4 7.58172 4 12C4 13.8106 4.6015 15.4807 5.61557 16.8214C7.25639 15.0841 9.58144 14 12.1597 14C14.6441 14 16.8933 15.0066 18.5218 16.6342C19.4526 15.3267 20 13.7273 20 12C20 7.58172 16.4183 4 12 4ZM12 5C14.2091 5 16 6.79086 16 9C16 11.2091 14.2091 13 12 13C9.79086 13 8 11.2091 8 9C8 6.79086 9.79086 5 12 5ZM12 7C10.8954 7 10 7.89543 10 9C10 10.1046 10.8954 11 12 11C13.1046 11 14 10.1046 14 9C14 7.89543 13.1046 7 12 7Z"/></svg>';

var addCircleFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM11 11H7V13H11V17H13V13H17V11H13V7H11V11Z"/></svg>';

var addCircleLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M11 11V7H13V11H17V13H13V17H11V13H7V11H11ZM12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20Z"/></svg>';

var addLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M11 11V5H13V11H19V13H13V19H11V13H5V11H11Z"/></svg>';

var adminFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 14V22H4C4 17.5817 7.58172 14 12 14ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM21 17H22V22H14V17H15V16C15 14.3431 16.3431 13 18 13C19.6569 13 21 14.3431 21 16V17ZM19 17V16C19 15.4477 18.5523 15 18 15C17.4477 15 17 15.4477 17 16V17H19Z"/></svg>';

var adminLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 14V16C8.68629 16 6 18.6863 6 22H4C4 17.5817 7.58172 14 12 14ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11ZM21 17H22V22H14V17H15V16C15 14.3431 16.3431 13 18 13C19.6569 13 21 14.3431 21 16V17ZM19 17V16C19 15.4477 18.5523 15 18 15C17.4477 15 17 15.4477 17 16V17H19Z"/></svg>';

var alertFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.8659 3.00017L22.3922 19.5002C22.6684 19.9785 22.5045 20.5901 22.0262 20.8662C21.8742 20.954 21.7017 21.0002 21.5262 21.0002H2.47363C1.92135 21.0002 1.47363 20.5525 1.47363 20.0002C1.47363 19.8246 1.51984 19.6522 1.60761 19.5002L11.1339 3.00017C11.41 2.52187 12.0216 2.358 12.4999 2.63414C12.6519 2.72191 12.7782 2.84815 12.8659 3.00017ZM10.9999 16.0002V18.0002H12.9999V16.0002H10.9999ZM10.9999 9.00017V14.0002H12.9999V9.00017H10.9999Z"/></svg>';

var alertLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.8659 3.00017L22.3922 19.5002C22.6684 19.9785 22.5045 20.5901 22.0262 20.8662C21.8742 20.954 21.7017 21.0002 21.5262 21.0002H2.47363C1.92135 21.0002 1.47363 20.5525 1.47363 20.0002C1.47363 19.8246 1.51984 19.6522 1.60761 19.5002L11.1339 3.00017C11.41 2.52187 12.0216 2.358 12.4999 2.63414C12.6519 2.72191 12.7782 2.84815 12.8659 3.00017ZM4.20568 19.0002H19.7941L11.9999 5.50017L4.20568 19.0002ZM10.9999 16.0002H12.9999V18.0002H10.9999V16.0002ZM10.9999 9.00017H12.9999V14.0002H10.9999V9.00017Z"/></svg>';

var arrowDownLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13.0001 16.1716L18.3641 10.8076L19.7783 12.2218L12.0001 20L4.22192 12.2218L5.63614 10.8076L11.0001 16.1716V4H13.0001V16.1716Z"/></svg>';

var arrowDownSLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z"/></svg>';

var arrowGoBackLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M5.82843 6.99955L8.36396 9.53509L6.94975 10.9493L2 5.99955L6.94975 1.0498L8.36396 2.46402L5.82843 4.99955H13C17.4183 4.99955 21 8.58127 21 12.9996C21 17.4178 17.4183 20.9996 13 20.9996H4V18.9996H13C16.3137 18.9996 19 16.3133 19 12.9996C19 9.68584 16.3137 6.99955 13 6.99955H5.82843Z"/></svg>';

var arrowGoForwardLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.1716 6.99955H11C7.68629 6.99955 5 9.68584 5 12.9996C5 16.3133 7.68629 18.9996 11 18.9996H20V20.9996H11C6.58172 20.9996 3 17.4178 3 12.9996C3 8.58127 6.58172 4.99955 11 4.99955H18.1716L15.636 2.46402L17.0503 1.0498L22 5.99955L17.0503 10.9493L15.636 9.53509L18.1716 6.99955Z"/></svg>';

var arrowLeftLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7.82843 10.9999H20V12.9999H7.82843L13.1924 18.3638L11.7782 19.778L4 11.9999L11.7782 4.22168L13.1924 5.63589L7.82843 10.9999Z"/></svg>';

var arrowLeftSLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10.8284 12.0007L15.7782 16.9504L14.364 18.3646L8 12.0007L14.364 5.63672L15.7782 7.05093L10.8284 12.0007Z"/></svg>';

var arrowRightLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z"/></svg>';

var arrowRightSLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13.1717 12.0007L8.22192 7.05093L9.63614 5.63672L16.0001 12.0007L9.63614 18.3646L8.22192 16.9504L13.1717 12.0007Z"/></svg>';

var arrowUpLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13.0001 7.82843V20H11.0001V7.82843L5.63614 13.1924L4.22192 11.7782L12.0001 4L19.7783 11.7782L18.3641 13.1924L13.0001 7.82843Z"/></svg>';

var arrowUpSLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M11.9999 10.8284L7.0502 15.7782L5.63599 14.364L11.9999 8L18.3639 14.364L16.9497 15.7782L11.9999 10.8284Z"/></svg>';

var attachmentLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 13.5V8C14 5.79086 12.2091 4 10 4C7.79086 4 6 5.79086 6 8V13.5C6 17.0899 8.91015 20 12.5 20C16.0899 20 19 17.0899 19 13.5V4H21V13.5C21 18.1944 17.1944 22 12.5 22C7.80558 22 4 18.1944 4 13.5V8C4 4.68629 6.68629 2 10 2C13.3137 2 16 4.68629 16 8V13.5C16 15.433 14.433 17 12.5 17C10.567 17 9 15.433 9 13.5V8H11V13.5C11 14.3284 11.6716 15 12.5 15C13.3284 15 14 14.3284 14 13.5Z"/></svg>';

var calendarFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M2 11H22V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V11ZM17 3H21C21.5523 3 22 3.44772 22 4V9H2V4C2 3.44772 2.44772 3 3 3H7V1H9V3H15V1H17V3Z"/></svg>';

var calendarLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M9 1V3H15V1H17V3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H7V1H9ZM20 11H4V19H20V11ZM7 5H4V9H20V5H17V7H15V5H9V7H7V5Z"/></svg>';

var chat1Fill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10 3H14C18.4183 3 22 6.58172 22 11C22 15.4183 18.4183 19 14 19V22.5C9 20.5 2 17.5 2 11C2 6.58172 5.58172 3 10 3Z"/></svg>';

var chat1Line = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10 3H14C18.4183 3 22 6.58172 22 11C22 15.4183 18.4183 19 14 19V22.5C9 20.5 2 17.5 2 11C2 6.58172 5.58172 3 10 3ZM12 17H14C17.3137 17 20 14.3137 20 11C20 7.68629 17.3137 5 14 5H10C6.68629 5 4 7.68629 4 11C4 14.61 6.46208 16.9656 12 19.4798V17Z"/></svg>';

var checkFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z"/></svg>';

var checkLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z"/></svg>';

var checkboxCircleFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM17.4571 9.45711L11 15.9142L6.79289 11.7071L8.20711 10.2929L11 13.0858L16.0429 8.04289L17.4571 9.45711Z"/></svg>';

var checkboxCircleLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12C20 16.4183 16.4183 20 12 20C7.58172 20 4 16.4183 4 12ZM12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM17.4571 9.45711L16.0429 8.04289L11 13.0858L8.20711 10.2929L6.79289 11.7071L11 15.9142L17.4571 9.45711Z"/></svg>';

var clipboardLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7 4V2H17V4H20.0066C20.5552 4 21 4.44495 21 4.9934V21.0066C21 21.5552 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5551 3 21.0066V4.9934C3 4.44476 3.44495 4 3.9934 4H7ZM7 6H5V20H19V6H17V8H7V6ZM9 4V6H15V4H9Z"/></svg>';

var closeCircleFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 10.5858L9.17157 7.75736L7.75736 9.17157L10.5858 12L7.75736 14.8284L9.17157 16.2426L12 13.4142L14.8284 16.2426L16.2426 14.8284L13.4142 12L16.2426 9.17157L14.8284 7.75736L12 10.5858Z"/></svg>';

var closeCircleLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 10.5858L14.8284 7.75736L16.2426 9.17157L13.4142 12L16.2426 14.8284L14.8284 16.2426L12 13.4142L9.17157 16.2426L7.75736 14.8284L10.5858 12L7.75736 9.17157L9.17157 7.75736L12 10.5858Z"/></svg>';

var closeLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M11.9997 10.5865L16.9495 5.63672L18.3637 7.05093L13.4139 12.0007L18.3637 16.9504L16.9495 18.3646L11.9997 13.4149L7.04996 18.3646L5.63574 16.9504L10.5855 12.0007L5.63574 7.05093L7.04996 5.63672L11.9997 10.5865Z"/></svg>';

var contactsBookFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7 2V22H3V2H7ZM9 2H19.0049C20.1068 2 21 2.89821 21 3.9908V20.0092C21 21.1087 20.1074 22 19.0049 22H9V2ZM22 6H24V10H22V6ZM22 12H24V16H22V12ZM15 12C16.1046 12 17 11.1046 17 10C17 8.89543 16.1046 8 15 8C13.8954 8 13 8.89543 13 10C13 11.1046 13.8954 12 15 12ZM12 16H18C18 14.3431 16.6569 13 15 13C13.3431 13 12 14.3431 12 16Z"/></svg>';

var contactsBookLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 2H19.0049C20.1068 2 21 2.89821 21 3.9908V20.0092C21 21.1087 20.1074 22 19.0049 22H3V2ZM7 4H5V20H7V4ZM9 20H19V4H9V20ZM11 16C11 14.3431 12.3431 13 14 13C15.6569 13 17 14.3431 17 16H11ZM14 12C12.8954 12 12 11.1046 12 10C12 8.89543 12.8954 8 14 8C15.1046 8 16 8.89543 16 10C16 11.1046 15.1046 12 14 12ZM22 6H24V10H22V6ZM22 12H24V16H22V12Z"/></svg>';

var contactsFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M2 22C2 17.5817 5.58172 14 10 14C14.4183 14 18 17.5817 18 22H2ZM10 13C6.685 13 4 10.315 4 7C4 3.685 6.685 1 10 1C13.315 1 16 3.685 16 7C16 10.315 13.315 13 10 13ZM20 17H24V19H20V17ZM17 12H24V14H17V12ZM19 7H24V9H19V7Z"/></svg>';

var contactsLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M19 7H24V9H19V7ZM17 12H24V14H17V12ZM20 17H24V19H20V17ZM2 22C2 17.5817 5.58172 14 10 14C14.4183 14 18 17.5817 18 22H16C16 18.6863 13.3137 16 10 16C6.68629 16 4 18.6863 4 22H2ZM10 13C6.685 13 4 10.315 4 7C4 3.685 6.685 1 10 1C13.315 1 16 3.685 16 7C16 10.315 13.315 13 10 13ZM10 11C12.21 11 14 9.21 14 7C14 4.79 12.21 3 10 3C7.79 3 6 4.79 6 7C6 9.21 7.79 11 10 11Z"/></svg>';

var dashboardFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 12C3 12.5523 3.44772 13 4 13H10C10.5523 13 11 12.5523 11 12V4C11 3.44772 10.5523 3 10 3H4C3.44772 3 3 3.44772 3 4V12ZM3 20C3 20.5523 3.44772 21 4 21H10C10.5523 21 11 20.5523 11 20V16C11 15.4477 10.5523 15 10 15H4C3.44772 15 3 15.4477 3 16V20ZM13 20C13 20.5523 13.4477 21 14 21H20C20.5523 21 21 20.5523 21 20V12C21 11.4477 20.5523 11 20 11H14C13.4477 11 13 11.4477 13 12V20ZM14 3C13.4477 3 13 3.44772 13 4V8C13 8.55228 13.4477 9 14 9H20C20.5523 9 21 8.55228 21 8V4C21 3.44772 20.5523 3 20 3H14Z"/></svg>';

var dashboardLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 21C13.4477 21 13 20.5523 13 20V12C13 11.4477 13.4477 11 14 11H20C20.5523 11 21 11.4477 21 12V20C21 20.5523 20.5523 21 20 21H14ZM4 13C3.44772 13 3 12.5523 3 12V4C3 3.44772 3.44772 3 4 3H10C10.5523 3 11 3.44772 11 4V12C11 12.5523 10.5523 13 10 13H4ZM9 11V5H5V11H9ZM4 21C3.44772 21 3 20.5523 3 20V16C3 15.4477 3.44772 15 4 15H10C10.5523 15 11 15.4477 11 16V20C11 20.5523 10.5523 21 10 21H4ZM5 19H9V17H5V19ZM15 19H19V13H15V19ZM13 4C13 3.44772 13.4477 3 14 3H20C20.5523 3 21 3.44772 21 4V8C21 8.55228 20.5523 9 20 9H14C13.4477 9 13 8.55228 13 8V4ZM15 5V7H19V5H15Z"/></svg>';

var deleteBinFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM9 11V17H11V11H9ZM13 11V17H15V11H13ZM9 4V6H15V4H9Z"/></svg>';

var deleteBinLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17 6H22V8H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V8H2V6H7V3C7 2.44772 7.44772 2 8 2H16C16.5523 2 17 2.44772 17 3V6ZM18 8H6V20H18V8ZM9 11H11V17H9V11ZM13 11H15V17H13V11ZM9 4V6H15V4H9Z"/></svg>';

var discussFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16.8 19L14 22.5L11.2 19H6C5.44772 19 5 18.5523 5 18V7.10256C5 6.55028 5.44772 6.10256 6 6.10256H22C22.5523 6.10256 23 6.55028 23 7.10256V18C23 18.5523 22.5523 19 22 19H16.8ZM2 2H19V4H3V15H1V3C1 2.44772 1.44772 2 2 2Z"/></svg>';

var discussLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 22.5L11.2 19H6C5.44772 19 5 18.5523 5 18V7.10256C5 6.55028 5.44772 6.10256 6 6.10256H22C22.5523 6.10256 23 6.55028 23 7.10256V18C23 18.5523 22.5523 19 22 19H16.8L14 22.5ZM15.8387 17H21V8.10256H7V17H11.2H12.1613L14 19.2984L15.8387 17ZM2 2H19V4H3V15H1V3C1 2.44772 1.44772 2 2 2Z"/></svg>';

var downloadFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 19H21V21H3V19ZM13 9H20L12 17L4 9H11V1H13V9Z"/></svg>';

var downloadLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 19H21V21H3V19ZM13 13.1716L19.0711 7.1005L20.4853 8.51472L12 17L3.51472 8.51472L4.92893 7.1005L11 13.1716V2H13V13.1716Z"/></svg>';

var edit2Line = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M5 18.89H6.41421L15.7279 9.57627L14.3137 8.16206L5 17.4758V18.89ZM21 20.89H3V16.6473L16.435 3.21231C16.8256 2.82179 17.4587 2.82179 17.8492 3.21231L20.6777 6.04074C21.0682 6.43126 21.0682 7.06443 20.6777 7.45495L9.24264 18.89H21V20.89ZM15.7279 6.74785L17.1421 8.16206L18.5563 6.74785L17.1421 5.33363L15.7279 6.74785Z"/></svg>';

var editLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6.41421 15.89L16.5563 5.74785L15.1421 4.33363L5 14.4758V15.89H6.41421ZM7.24264 17.89H3V13.6473L14.435 2.21231C14.8256 1.82179 15.4587 1.82179 15.8492 2.21231L18.6777 5.04074C19.0682 5.43126 19.0682 6.06443 18.6777 6.45495L7.24264 17.89ZM3 19.89H21V21.89H3V19.89Z"/></svg>';

var errorWarningFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM11 15V17H13V15H11ZM11 7V13H13V7H11Z"/></svg>';

var errorWarningLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z"/></svg>';

var externalLinkLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M10 6V8H5V19H16V14H18V20C18 20.5523 17.5523 21 17 21H4C3.44772 21 3 20.5523 3 20V7C3 6.44772 3.44772 6 4 6H10ZM21 3V11H19L18.9999 6.413L11.2071 14.2071L9.79289 12.7929L17.5849 5H13V3H21Z"/></svg>';

var eyeFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M1.18164 12C2.12215 6.87976 6.60812 3 12.0003 3C17.3924 3 21.8784 6.87976 22.8189 12C21.8784 17.1202 17.3924 21 12.0003 21C6.60812 21 2.12215 17.1202 1.18164 12ZM12.0003 17C14.7617 17 17.0003 14.7614 17.0003 12C17.0003 9.23858 14.7617 7 12.0003 7C9.23884 7 7.00026 9.23858 7.00026 12C7.00026 14.7614 9.23884 17 12.0003 17ZM12.0003 15C10.3434 15 9.00026 13.6569 9.00026 12C9.00026 10.3431 10.3434 9 12.0003 9C13.6571 9 15.0003 10.3431 15.0003 12C15.0003 13.6569 13.6571 15 12.0003 15Z"/></svg>';

var eyeLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.0003 3C17.3924 3 21.8784 6.87976 22.8189 12C21.8784 17.1202 17.3924 21 12.0003 21C6.60812 21 2.12215 17.1202 1.18164 12C2.12215 6.87976 6.60812 3 12.0003 3ZM12.0003 19C16.2359 19 19.8603 16.052 20.7777 12C19.8603 7.94803 16.2359 5 12.0003 5C7.7646 5 4.14022 7.94803 3.22278 12C4.14022 16.052 7.7646 19 12.0003 19ZM12.0003 16.5C9.51498 16.5 7.50026 14.4853 7.50026 12C7.50026 9.51472 9.51498 7.5 12.0003 7.5C14.4855 7.5 16.5003 9.51472 16.5003 12C16.5003 14.4853 14.4855 16.5 12.0003 16.5ZM12.0003 14.5C13.381 14.5 14.5003 13.3807 14.5003 12C14.5003 10.6193 13.381 9.5 12.0003 9.5C10.6196 9.5 9.50026 10.6193 9.50026 12C9.50026 13.3807 10.6196 14.5 12.0003 14.5Z"/></svg>';

var eyeOffLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17.8827 19.2968C16.1814 20.3755 14.1638 21.0002 12.0003 21.0002C6.60812 21.0002 2.12215 17.1204 1.18164 12.0002C1.61832 9.62282 2.81932 7.5129 4.52047 5.93457L1.39366 2.80777L2.80788 1.39355L22.6069 21.1925L21.1927 22.6068L17.8827 19.2968ZM5.9356 7.3497C4.60673 8.56015 3.6378 10.1672 3.22278 12.0002C4.14022 16.0521 7.7646 19.0002 12.0003 19.0002C13.5997 19.0002 15.112 18.5798 16.4243 17.8384L14.396 15.8101C13.7023 16.2472 12.8808 16.5002 12.0003 16.5002C9.51498 16.5002 7.50026 14.4854 7.50026 12.0002C7.50026 11.1196 7.75317 10.2981 8.19031 9.60442L5.9356 7.3497ZM12.9139 14.328L9.67246 11.0866C9.5613 11.3696 9.50026 11.6777 9.50026 12.0002C9.50026 13.3809 10.6196 14.5002 12.0003 14.5002C12.3227 14.5002 12.6309 14.4391 12.9139 14.328ZM20.8068 16.5925L19.376 15.1617C20.0319 14.2268 20.5154 13.1586 20.7777 12.0002C19.8603 7.94818 16.2359 5.00016 12.0003 5.00016C11.1544 5.00016 10.3329 5.11773 9.55249 5.33818L7.97446 3.76015C9.22127 3.26959 10.5793 3.00016 12.0003 3.00016C17.3924 3.00016 21.8784 6.87992 22.8189 12.0002C22.5067 13.6998 21.8038 15.2628 20.8068 16.5925ZM11.7229 7.50857C11.8146 7.50299 11.9071 7.50016 12.0003 7.50016C14.4855 7.50016 16.5003 9.51488 16.5003 12.0002C16.5003 12.0933 16.4974 12.1858 16.4919 12.2775L11.7229 7.50857Z"/></svg>';

var feedbackFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6.45455 19L2 22.5V4C2 3.44772 2.44772 3 3 3H21C21.5523 3 22 3.44772 22 4V18C22 18.5523 21.5523 19 21 19H6.45455ZM11 13V15H13V13H11ZM11 7V12H13V7H11Z"/></svg>';

var feedbackLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6.45455 19L2 22.5V4C2 3.44772 2.44772 3 3 3H21C21.5523 3 22 3.44772 22 4V18C22 18.5523 21.5523 19 21 19H6.45455ZM4 18.3851L5.76282 17H20V5H4V18.3851ZM11 13H13V15H11V13ZM11 7H13V12H11V7Z"/></svg>';

var fileAddLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M15 4H5V20H19V8H15V4ZM3 2.9918C3 2.44405 3.44749 2 3.9985 2H16L20.9997 7L21 20.9925C21 21.5489 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5447 3 21.0082V2.9918ZM11 11V8H13V11H16V13H13V16H11V13H8V11H11Z"/></svg>';

var fileCopyLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6.9998 6V3C6.9998 2.44772 7.44752 2 7.9998 2H19.9998C20.5521 2 20.9998 2.44772 20.9998 3V17C20.9998 17.5523 20.5521 18 19.9998 18H16.9998V20.9991C16.9998 21.5519 16.5499 22 15.993 22H4.00666C3.45059 22 3 21.5554 3 20.9991L3.0026 7.00087C3.0027 6.44811 3.45264 6 4.00942 6H6.9998ZM5.00242 8L5.00019 20H14.9998V8H5.00242ZM8.9998 6H16.9998V16H18.9998V4H8.9998V6Z"/></svg>';

var fileDownloadLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13 12H16L12 16L8 12H11V8H13V12ZM15 4H5V20H19V8H15V4ZM3 2.9918C3 2.44405 3.44749 2 3.9985 2H16L20.9997 7L21 20.9925C21 21.5489 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5447 3 21.0082V2.9918Z"/></svg>';

var fileLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M9 2.00318V2H19.9978C20.5513 2 21 2.45531 21 2.9918V21.0082C21 21.556 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5501 3 20.9932V8L9 2.00318ZM5.82918 8H9V4.83086L5.82918 8ZM11 4V9C11 9.55228 10.5523 10 10 10H5V20H19V4H11Z"/></svg>';

var fileTextLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M21 8V20.9932C21 21.5501 20.5552 22 20.0066 22H3.9934C3.44495 22 3 21.556 3 21.0082V2.9918C3 2.45531 3.4487 2 4.00221 2H14.9968L21 8ZM19 9H14V4H5V20H19V9ZM8 7H11V9H8V7ZM8 11H16V13H8V11ZM8 15H16V17H8V15Z"/></svg>';

var fileUploadLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M15 4H5V20H19V8H15V4ZM3 2.9918C3 2.44405 3.44749 2 3.9985 2H16L20.9997 7L21 20.9925C21 21.5489 20.5551 22 20.0066 22H3.9934C3.44476 22 3 21.5447 3 21.0082V2.9918ZM13 12V16H11V12H8L12 8L16 12H13Z"/></svg>';

var filterFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M21 4V6H20L14 15V22H10V15L4 6H3V4H21Z"/></svg>';

var filterLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M21 4V6H20L15 13.5V22H9V13.5L4 6H3V4H21ZM6.4037 6L11 12.8944V20H13V12.8944L17.5963 6H6.4037Z"/></svg>';

var folderLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4 5V19H20V7H11.5858L9.58579 5H4ZM12.4142 5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H10.4142L12.4142 5Z"/></svg>';

var folderOpenLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 21C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H10.4142L12.4142 5H20C20.5523 5 21 5.44772 21 6V9H19V7H11.5858L9.58579 5H4V16.998L5.5 11H22.5L20.1894 20.2425C20.0781 20.6877 19.6781 21 19.2192 21H3ZM19.9384 13H7.06155L5.56155 19H18.4384L19.9384 13Z"/></svg>';

var fullscreenExitLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18 7H22V9H16V3H18V7ZM8 9H2V7H6V3H8V9ZM18 17V21H16V15H22V17H18ZM8 15V21H6V17H2V15H8Z"/></svg>';

var fullscreenLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M8 3V5H4V9H2V3H8ZM2 21V15H4V19H8V21H2ZM22 21H16V19H20V15H22V21ZM22 9H20V5H16V3H22V9Z"/></svg>';

var groupFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M2 22C2 17.5817 5.58172 14 10 14C14.4183 14 18 17.5817 18 22H2ZM10 13C6.685 13 4 10.315 4 7C4 3.685 6.685 1 10 1C13.315 1 16 3.685 16 7C16 10.315 13.315 13 10 13ZM17.3628 15.2332C20.4482 16.0217 22.7679 18.7235 22.9836 22H20C20 19.3902 19.0002 17.0139 17.3628 15.2332ZM15.3401 12.9569C16.9728 11.4922 18 9.36607 18 7C18 5.58266 17.6314 4.25141 16.9849 3.09687C19.2753 3.55397 21 5.57465 21 8C21 10.7625 18.7625 13 16 13C15.7763 13 15.556 12.9853 15.3401 12.9569Z"/></svg>';

var groupLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M2 22C2 17.5817 5.58172 14 10 14C14.4183 14 18 17.5817 18 22H16C16 18.6863 13.3137 16 10 16C6.68629 16 4 18.6863 4 22H2ZM10 13C6.685 13 4 10.315 4 7C4 3.685 6.685 1 10 1C13.315 1 16 3.685 16 7C16 10.315 13.315 13 10 13ZM10 11C12.21 11 14 9.21 14 7C14 4.79 12.21 3 10 3C7.79 3 6 4.79 6 7C6 9.21 7.79 11 10 11ZM18.2837 14.7028C21.0644 15.9561 23 18.752 23 22H21C21 19.564 19.5483 17.4671 17.4628 16.5271L18.2837 14.7028ZM17.5962 3.41321C19.5944 4.23703 21 6.20361 21 8.5C21 11.3702 18.8042 13.7252 16 13.9776V11.9646C17.6967 11.7222 19 10.264 19 8.5C19 7.11935 18.2016 5.92603 17.041 5.35635L17.5962 3.41321Z"/></svg>';

var heartFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.001 4.52853C14.35 2.42 17.98 2.49 20.2426 4.75736C22.5053 7.02472 22.583 10.637 20.4786 12.993L11.9999 21.485L3.52138 12.993C1.41705 10.637 1.49571 7.01901 3.75736 4.75736C6.02157 2.49315 9.64519 2.41687 12.001 4.52853Z"/></svg>';

var heartLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.001 4.52853C14.35 2.42 17.98 2.49 20.2426 4.75736C22.5053 7.02472 22.583 10.637 20.4786 12.993L11.9999 21.485L3.52138 12.993C1.41705 10.637 1.49571 7.01901 3.75736 4.75736C6.02157 2.49315 9.64519 2.41687 12.001 4.52853ZM18.827 6.1701C17.3279 4.66794 14.9076 4.60701 13.337 6.01687L12.0019 7.21524L10.6661 6.01781C9.09098 4.60597 6.67506 4.66808 5.17157 6.17157C3.68183 7.66131 3.60704 10.0473 4.97993 11.6232L11.9999 18.6543L19.0201 11.6232C20.3935 10.0467 20.319 7.66525 18.827 6.1701Z"/></svg>';

var homeFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M21 20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9.48907C3 9.18048 3.14247 8.88917 3.38606 8.69972L11.3861 2.47749C11.7472 2.19663 12.2528 2.19663 12.6139 2.47749L20.6139 8.69972C20.8575 8.88917 21 9.18048 21 9.48907V20Z"/></svg>';

var homeLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M21 20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V9.48907C3 9.18048 3.14247 8.88917 3.38606 8.69972L11.3861 2.47749C11.7472 2.19663 12.2528 2.19663 12.6139 2.47749L20.6139 8.69972C20.8575 8.88917 21 9.18048 21 9.48907V20ZM19 19V9.97815L12 4.53371L5 9.97815V19H19Z"/></svg>';

var informationFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM11 11V17H13V11H11ZM11 7V9H13V7H11Z"/></svg>';

var informationLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11 7H13V9H11V7ZM11 11H13V17H11V11Z"/></svg>';

var link = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.3638 15.5355L16.9496 14.1213L18.3638 12.7071C20.3164 10.7545 20.3164 7.58866 18.3638 5.63604C16.4112 3.68341 13.2453 3.68341 11.2927 5.63604L9.87849 7.05025L8.46428 5.63604L9.87849 4.22182C12.6122 1.48815 17.0443 1.48815 19.778 4.22182C22.5117 6.95549 22.5117 11.3876 19.778 14.1213L18.3638 15.5355ZM15.5353 18.364L14.1211 19.7782C11.3875 22.5118 6.95531 22.5118 4.22164 19.7782C1.48797 17.0445 1.48797 12.6123 4.22164 9.87868L5.63585 8.46446L7.05007 9.87868L5.63585 11.2929C3.68323 13.2455 3.68323 16.4113 5.63585 18.364C7.58847 20.3166 10.7543 20.3166 12.7069 18.364L14.1211 16.9497L15.5353 18.364ZM14.8282 7.75736L16.2425 9.17157L9.17139 16.2426L7.75717 14.8284L14.8282 7.75736Z"/></svg>';

var linkUnlink = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M17 17H22V19H19V22H17V17ZM7 7H2V5H5V2H7V7ZM18.364 15.5355L16.9497 14.1213L18.364 12.7071C20.3166 10.7545 20.3166 7.58866 18.364 5.63604C16.4113 3.68342 13.2455 3.68342 11.2929 5.63604L9.87868 7.05025L8.46447 5.63604L9.87868 4.22183C12.6123 1.48816 17.0445 1.48816 19.7782 4.22183C22.5118 6.9555 22.5118 11.3877 19.7782 14.1213L18.364 15.5355ZM15.5355 18.364L14.1213 19.7782C11.3877 22.5118 6.9555 22.5118 4.22183 19.7782C1.48816 17.0445 1.48816 12.6123 4.22183 9.87868L5.63604 8.46447L7.05025 9.87868L5.63604 11.2929C3.68342 13.2455 3.68342 16.4113 5.63604 18.364C7.58866 20.3166 10.7545 20.3166 12.7071 18.364L14.1213 16.9497L15.5355 18.364ZM14.8284 7.75736L16.2426 9.17157L9.17157 16.2426L7.75736 14.8284L14.8284 7.75736Z"/></svg>';

var loaderFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M11.9995 2C12.5518 2 12.9995 2.44772 12.9995 3V6C12.9995 6.55228 12.5518 7 11.9995 7C11.4472 7 10.9995 6.55228 10.9995 6V3C10.9995 2.44772 11.4472 2 11.9995 2ZM11.9995 17C12.5518 17 12.9995 17.4477 12.9995 18V21C12.9995 21.5523 12.5518 22 11.9995 22C11.4472 22 10.9995 21.5523 10.9995 21V18C10.9995 17.4477 11.4472 17 11.9995 17ZM20.6597 7C20.9359 7.47829 20.772 8.08988 20.2937 8.36602L17.6956 9.86602C17.2173 10.1422 16.6057 9.97829 16.3296 9.5C16.0535 9.02171 16.2173 8.41012 16.6956 8.13398L19.2937 6.63397C19.772 6.35783 20.3836 6.52171 20.6597 7ZM7.66935 14.5C7.94549 14.9783 7.78161 15.5899 7.30332 15.866L4.70525 17.366C4.22695 17.6422 3.61536 17.4783 3.33922 17C3.06308 16.5217 3.22695 15.9101 3.70525 15.634L6.30332 14.134C6.78161 13.8578 7.3932 14.0217 7.66935 14.5ZM20.6597 17C20.3836 17.4783 19.772 17.6422 19.2937 17.366L16.6956 15.866C16.2173 15.5899 16.0535 14.9783 16.3296 14.5C16.6057 14.0217 17.2173 13.8578 17.6956 14.134L20.2937 15.634C20.772 15.9101 20.9359 16.5217 20.6597 17ZM7.66935 9.5C7.3932 9.97829 6.78161 10.1422 6.30332 9.86602L3.70525 8.36602C3.22695 8.08988 3.06308 7.47829 3.33922 7C3.61536 6.52171 4.22695 6.35783 4.70525 6.63397L7.30332 8.13398C7.78161 8.41012 7.94549 9.02171 7.66935 9.5Z"/></svg>';

var loaderLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M11.9995 2C12.5518 2 12.9995 2.44772 12.9995 3V6C12.9995 6.55228 12.5518 7 11.9995 7C11.4472 7 10.9995 6.55228 10.9995 6V3C10.9995 2.44772 11.4472 2 11.9995 2ZM11.9995 17C12.5518 17 12.9995 17.4477 12.9995 18V21C12.9995 21.5523 12.5518 22 11.9995 22C11.4472 22 10.9995 21.5523 10.9995 21V18C10.9995 17.4477 11.4472 17 11.9995 17ZM20.6597 7C20.9359 7.47829 20.772 8.08988 20.2937 8.36602L17.6956 9.86602C17.2173 10.1422 16.6057 9.97829 16.3296 9.5C16.0535 9.02171 16.2173 8.41012 16.6956 8.13398L19.2937 6.63397C19.772 6.35783 20.3836 6.52171 20.6597 7ZM7.66935 14.5C7.94549 14.9783 7.78161 15.5899 7.30332 15.866L4.70525 17.366C4.22695 17.6422 3.61536 17.4783 3.33922 17C3.06308 16.5217 3.22695 15.9101 3.70525 15.634L6.30332 14.134C6.78161 13.8578 7.3932 14.0217 7.66935 14.5ZM20.6597 17C20.3836 17.4783 19.772 17.6422 19.2937 17.366L16.6956 15.866C16.2173 15.5899 16.0535 14.9783 16.3296 14.5C16.6057 14.0217 17.2173 13.8578 17.6956 14.134L20.2937 15.634C20.772 15.9101 20.9359 16.5217 20.6597 17ZM7.66935 9.5C7.3932 9.97829 6.78161 10.1422 6.30332 9.86602L3.70525 8.36602C3.22695 8.08988 3.06308 7.47829 3.33922 7C3.61536 6.52171 4.22695 6.35783 4.70525 6.63397L7.30332 8.13398C7.78161 8.41012 7.94549 9.02171 7.66935 9.5Z"/></svg>';

var lockFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M19 10H20C20.5523 10 21 10.4477 21 11V21C21 21.5523 20.5523 22 20 22H4C3.44772 22 3 21.5523 3 21V11C3 10.4477 3.44772 10 4 10H5V9C5 5.13401 8.13401 2 12 2C15.866 2 19 5.13401 19 9V10ZM17 10V9C17 6.23858 14.7614 4 12 4C9.23858 4 7 6.23858 7 9V10H17ZM11 14V18H13V14H11Z"/></svg>';

var lockLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M19 10H20C20.5523 10 21 10.4477 21 11V21C21 21.5523 20.5523 22 20 22H4C3.44772 22 3 21.5523 3 21V11C3 10.4477 3.44772 10 4 10H5V9C5 5.13401 8.13401 2 12 2C15.866 2 19 5.13401 19 9V10ZM5 12V20H19V12H5ZM11 14H13V18H11V14ZM17 10V9C17 6.23858 14.7614 4 12 4C9.23858 4 7 6.23858 7 9V10H17Z"/></svg>';

var lockUnlockLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7 10H20C20.5523 10 21 10.4477 21 11V21C21 21.5523 20.5523 22 20 22H4C3.44772 22 3 21.5523 3 21V11C3 10.4477 3.44772 10 4 10H5V9C5 5.13401 8.13401 2 12 2C14.7405 2 17.1131 3.5748 18.2624 5.86882L16.4731 6.76344C15.6522 5.12486 13.9575 4 12 4C9.23858 4 7 6.23858 7 9V10ZM5 12V20H19V12H5ZM10 15H14V17H10V15Z"/></svg>';

var loginBoxLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4 15H6V20H18V4H6V9H4V3C4 2.44772 4.44772 2 5 2H19C19.5523 2 20 2.44772 20 3V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V15ZM10 11V8L15 12L10 16V13H2V11H10Z"/></svg>';

var logoutBoxLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4 18H6V20H18V4H6V6H4V3C4 2.44772 4.44772 2 5 2H19C19.5523 2 20 2.44772 20 3V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V18ZM6 11H13V13H6V16L1 12L6 8V11Z"/></svg>';

var logoutBoxRLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M5 22C4.44772 22 4 21.5523 4 21V3C4 2.44772 4.44772 2 5 2H19C19.5523 2 20 2.44772 20 3V6H18V4H6V20H18V18H20V21C20 21.5523 19.5523 22 19 22H5ZM18 16V13H11V11H18V8L23 12L18 16Z"/></svg>';

var mailFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3ZM12.0606 11.6829L5.64722 6.2377L4.35278 7.7623L12.0731 14.3171L19.6544 7.75616L18.3456 6.24384L12.0606 11.6829Z"/></svg>';

var mailLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3ZM20 7.23792L12.0718 14.338L4 7.21594V19H20V7.23792ZM4.51146 5L12.0619 11.662L19.501 5H4.51146Z"/></svg>';

var menuFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 4H21V6H3V4ZM3 11H21V13H3V11ZM3 18H21V20H3V18Z"/></svg>';

var menuLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 4H21V6H3V4ZM3 11H21V13H3V11ZM3 18H21V20H3V18Z"/></svg>';

var messageFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6.45455 19L2 22.5V4C2 3.44772 2.44772 3 3 3H21C21.5523 3 22 3.44772 22 4V18C22 18.5523 21.5523 19 21 19H6.45455ZM8 10V12H16V10H8Z"/></svg>';

var messageLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6.45455 19L2 22.5V4C2 3.44772 2.44772 3 3 3H21C21.5523 3 22 3.44772 22 4V18C22 18.5523 21.5523 19 21 19H6.45455ZM5.76282 17H20V5H4V18.3851L5.76282 17ZM8 10H16V12H8V10Z"/></svg>';

var more2Line = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C11.175 3 10.5 3.675 10.5 4.5C10.5 5.325 11.175 6 12 6C12.825 6 13.5 5.325 13.5 4.5C13.5 3.675 12.825 3 12 3ZM12 18C11.175 18 10.5 18.675 10.5 19.5C10.5 20.325 11.175 21 12 21C12.825 21 13.5 20.325 13.5 19.5C13.5 18.675 12.825 18 12 18ZM12 10.5C11.175 10.5 10.5 11.175 10.5 12C10.5 12.825 11.175 13.5 12 13.5C12.825 13.5 13.5 12.825 13.5 12C13.5 11.175 12.825 10.5 12 10.5Z"/></svg>';

var moreFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M5 10C3.9 10 3 10.9 3 12C3 13.1 3.9 14 5 14C6.1 14 7 13.1 7 12C7 10.9 6.1 10 5 10ZM19 10C17.9 10 17 10.9 17 12C17 13.1 17.9 14 19 14C20.1 14 21 13.1 21 12C21 10.9 20.1 10 19 10ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10Z"/></svg>';

var moreLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4.5 10.5C3.675 10.5 3 11.175 3 12C3 12.825 3.675 13.5 4.5 13.5C5.325 13.5 6 12.825 6 12C6 11.175 5.325 10.5 4.5 10.5ZM19.5 10.5C18.675 10.5 18 11.175 18 12C18 12.825 18.675 13.5 19.5 13.5C20.325 13.5 21 12.825 21 12C21 11.175 20.325 10.5 19.5 10.5ZM12 10.5C11.175 10.5 10.5 11.175 10.5 12C10.5 12.825 11.175 13.5 12 13.5C12.825 13.5 13.5 12.825 13.5 12C13.5 11.175 12.825 10.5 12 10.5Z"/></svg>';

var notificationFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C16.9706 2 21 6.04348 21 11.0314V20H3V11.0314C3 6.04348 7.02944 2 12 2ZM9.5 21H14.5C14.5 22.3807 13.3807 23.5 12 23.5C10.6193 23.5 9.5 22.3807 9.5 21Z"/></svg>';

var notificationLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M5 18H19V11.0314C19 7.14806 15.866 4 12 4C8.13401 4 5 7.14806 5 11.0314V18ZM12 2C16.9706 2 21 6.04348 21 11.0314V20H3V11.0314C3 6.04348 7.02944 2 12 2ZM9.5 21H14.5C14.5 22.3807 13.3807 23.5 12 23.5C10.6193 23.5 9.5 22.3807 9.5 21Z"/></svg>';

var pauseLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M6 5H8V19H6V5ZM16 5H18V19H16V5Z"/></svg>';

var phoneFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M21 16.42V19.9561C21 20.4811 20.5941 20.9167 20.0705 20.9537C19.6331 20.9846 19.2763 21 19 21C10.1634 21 3 13.8366 3 5C3 4.72371 3.01545 4.36687 3.04635 3.9295C3.08337 3.40588 3.51894 3 4.04386 3H7.5801C7.83678 3 8.05176 3.19442 8.07753 3.4498C8.10067 3.67907 8.12218 3.86314 8.14207 4.00202C8.34435 5.41472 8.75753 6.75936 9.3487 8.00303C9.44359 8.20265 9.38171 8.44159 9.20185 8.57006L7.04355 10.1118C8.35752 13.1811 10.8189 15.6425 13.8882 16.9565L15.4271 14.8019C15.5572 14.6199 15.799 14.5573 16.001 14.6532C17.2446 15.2439 18.5891 15.6566 20.0016 15.8584C20.1396 15.8782 20.3225 15.8995 20.5502 15.9225C20.8056 15.9483 21 16.1633 21 16.42Z"/></svg>';

var phoneLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M9.36556 10.6821C10.302 12.3288 11.6712 13.698 13.3179 14.6344L14.2024 13.3961C14.4965 12.9845 15.0516 12.8573 15.4956 13.0998C16.9024 13.8683 18.4571 14.3353 20.0789 14.4637C20.599 14.5049 21 14.9389 21 15.4606V19.9234C21 20.4361 20.6122 20.8657 20.1022 20.9181C19.5723 20.9726 19.0377 21 18.5 21C9.93959 21 3 14.0604 3 5.5C3 4.96227 3.02742 4.42771 3.08189 3.89776C3.1343 3.38775 3.56394 3 4.07665 3H8.53942C9.0611 3 9.49513 3.40104 9.5363 3.92109C9.66467 5.54288 10.1317 7.09764 10.9002 8.50444C11.1427 8.9484 11.0155 9.50354 10.6039 9.79757L9.36556 10.6821ZM6.84425 10.0252L8.7442 8.66809C8.20547 7.50514 7.83628 6.27183 7.64727 5H5.00907C5.00303 5.16632 5 5.333 5 5.5C5 12.9558 11.0442 19 18.5 19C18.667 19 18.8337 18.997 19 18.9909V16.3527C17.7282 16.1637 16.4949 15.7945 15.3319 15.2558L13.9748 17.1558C13.4258 16.9425 12.8956 16.6915 12.3874 16.4061L12.3293 16.373C10.3697 15.2587 8.74134 13.6303 7.627 11.6707L7.59394 11.6126C7.30849 11.1044 7.05754 10.5742 6.84425 10.0252Z"/></svg>';

var playLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M16.3944 12.0001L10 7.7371V16.263L16.3944 12.0001ZM19.376 12.4161L8.77735 19.4818C8.54759 19.635 8.23715 19.5729 8.08397 19.3432C8.02922 19.261 8 19.1645 8 19.0658V4.93433C8 4.65818 8.22386 4.43433 8.5 4.43433C8.59871 4.43433 8.69522 4.46355 8.77735 4.5183L19.376 11.584C19.6057 11.7372 19.6678 12.0477 19.5146 12.2774C19.478 12.3323 19.4309 12.3795 19.376 12.4161Z"/></svg>';

var questionFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM11 15V17H13V15H11ZM13 13.3551C14.4457 12.9248 15.5 11.5855 15.5 10C15.5 8.067 13.933 6.5 12 6.5C10.302 6.5 8.88637 7.70919 8.56731 9.31346L10.5288 9.70577C10.6656 9.01823 11.2723 8.5 12 8.5C12.8284 8.5 13.5 9.17157 13.5 10C13.5 10.8284 12.8284 11.5 12 11.5C11.4477 11.5 11 11.9477 11 12.5V14H13V13.3551Z"/></svg>';

var questionLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM11 15H13V17H11V15ZM13 13.3551V14H11V12.5C11 11.9477 11.4477 11.5 12 11.5C12.8284 11.5 13.5 10.8284 13.5 10C13.5 9.17157 12.8284 8.5 12 8.5C11.2723 8.5 10.6656 9.01823 10.5288 9.70577L8.56731 9.31346C8.88637 7.70919 10.302 6.5 12 6.5C13.933 6.5 15.5 8.067 15.5 10C15.5 11.5855 14.4457 12.9248 13 13.3551Z"/></svg>';

var refreshLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M5.46257 4.43262C7.21556 2.91688 9.5007 2 12 2C17.5228 2 22 6.47715 22 12C22 14.1361 21.3302 16.1158 20.1892 17.7406L17 12H20C20 7.58172 16.4183 4 12 4C9.84982 4 7.89777 4.84827 6.46023 6.22842L5.46257 4.43262ZM18.5374 19.5674C16.7844 21.0831 14.4993 22 12 22C6.47715 22 2 17.5228 2 12C2 9.86386 2.66979 7.88416 3.8108 6.25944L7 12H4C4 16.4183 7.58172 20 12 20C14.1502 20 16.1022 19.1517 17.5398 17.7716L18.5374 19.5674Z"/></svg>';

var saveFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18 21V13H6V21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3H17L21 7V20C21 20.5523 20.5523 21 20 21H18ZM16 21H8V15H16V21Z"/></svg>';

var saveLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7 19V13H17V19H19V7.82843L16.1716 5H5V19H7ZM4 3H17L21 7V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4C3 3.44772 3.44772 3 4 3ZM9 15V19H15V15H9Z"/></svg>';

var searchEyeLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18C12.8956 18 14.6146 17.2475 15.8748 16.0247L16.0247 15.8748ZM12.1779 7.17624C11.4834 7.48982 11 8.18846 11 9C11 10.1046 11.8954 11 13 11C13.8115 11 14.5102 10.5166 14.8238 9.82212C14.9383 10.1945 15 10.59 15 11C15 13.2091 13.2091 15 11 15C8.79086 15 7 13.2091 7 11C7 8.79086 8.79086 7 11 7C11.41 7 11.8055 7.06167 12.1779 7.17624Z"/></svg>';

var searchLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M18.031 16.6168L22.3137 20.8995L20.8995 22.3137L16.6168 18.031C15.0769 19.263 13.124 20 11 20C6.032 20 2 15.968 2 11C2 6.032 6.032 2 11 2C15.968 2 20 6.032 20 11C20 13.124 19.263 15.0769 18.031 16.6168ZM16.0247 15.8748C17.2475 14.6146 18 12.8956 18 11C18 7.1325 14.8675 4 11 4C7.1325 4 4 7.1325 4 11C4 14.8675 7.1325 18 11 18C12.8956 18 14.6146 17.2475 15.8748 16.0247L16.0247 15.8748Z"/></svg>';

var settings3Line = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3.33946 17.0002C2.90721 16.2515 2.58277 15.4702 2.36133 14.6741C3.3338 14.1779 3.99972 13.1668 3.99972 12.0002C3.99972 10.8345 3.3348 9.824 2.36353 9.32741C2.81025 7.71651 3.65857 6.21627 4.86474 4.99001C5.7807 5.58416 6.98935 5.65534 7.99972 5.072C9.01009 4.48866 9.55277 3.40635 9.4962 2.31604C11.1613 1.8846 12.8847 1.90004 14.5031 2.31862C14.4475 3.40806 14.9901 4.48912 15.9997 5.072C17.0101 5.65532 18.2187 5.58416 19.1346 4.99007C19.7133 5.57986 20.2277 6.25151 20.66 7.00021C21.0922 7.7489 21.4167 8.53025 21.6381 9.32628C20.6656 9.82247 19.9997 10.8336 19.9997 12.0002C19.9997 13.166 20.6646 14.1764 21.6359 14.673C21.1892 16.2839 20.3409 17.7841 19.1347 19.0104C18.2187 18.4163 17.0101 18.3451 15.9997 18.9284C14.9893 19.5117 14.4467 20.5941 14.5032 21.6844C12.8382 22.1158 11.1148 22.1004 9.49633 21.6818C9.55191 20.5923 9.00929 19.5113 7.99972 18.9284C6.98938 18.3451 5.78079 18.4162 4.86484 19.0103C4.28617 18.4205 3.77172 17.7489 3.33946 17.0002ZM8.99972 17.1964C10.0911 17.8265 10.8749 18.8227 11.2503 19.9659C11.7486 20.0133 12.2502 20.014 12.7486 19.9675C13.1238 18.8237 13.9078 17.8268 14.9997 17.1964C16.0916 16.5659 17.347 16.3855 18.5252 16.6324C18.8146 16.224 19.0648 15.7892 19.2729 15.334C18.4706 14.4373 17.9997 13.2604 17.9997 12.0002C17.9997 10.74 18.4706 9.5632 19.2729 8.6665C19.1688 8.4405 19.0538 8.21822 18.9279 8.00021C18.802 7.78219 18.667 7.57148 18.5233 7.36842C17.3457 7.61476 16.0911 7.43414 14.9997 6.80405C13.9083 6.17395 13.1246 5.17768 12.7491 4.03455C12.2509 3.98714 11.7492 3.98646 11.2509 4.03292C10.8756 5.17671 10.0916 6.17364 8.99972 6.80405C7.9078 7.43447 6.65245 7.61494 5.47428 7.36803C5.18485 7.77641 4.93463 8.21117 4.72656 8.66637C5.52881 9.56311 5.99972 10.74 5.99972 12.0002C5.99972 13.2604 5.52883 14.4372 4.72656 15.3339C4.83067 15.5599 4.94564 15.7822 5.07152 16.0002C5.19739 16.2182 5.3324 16.4289 5.47612 16.632C6.65377 16.3857 7.90838 16.5663 8.99972 17.1964ZM11.9997 15.0002C10.3429 15.0002 8.99972 13.6571 8.99972 12.0002C8.99972 10.3434 10.3429 9.00021 11.9997 9.00021C13.6566 9.00021 14.9997 10.3434 14.9997 12.0002C14.9997 13.6571 13.6566 15.0002 11.9997 15.0002ZM11.9997 13.0002C12.552 13.0002 12.9997 12.5525 12.9997 12.0002C12.9997 11.4479 12.552 11.0002 11.9997 11.0002C11.4474 11.0002 10.9997 11.4479 10.9997 12.0002C10.9997 12.5525 11.4474 13.0002 11.9997 13.0002Z"/></svg>';

var settingsFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 1L21.5 6.5V17.5L12 23L2.5 17.5V6.5L12 1ZM12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"/></svg>';

var settingsLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 1L21.5 6.5V17.5L12 23L2.5 17.5V6.5L12 1ZM12 3.311L4.5 7.65311V16.3469L12 20.689L19.5 16.3469V7.65311L12 3.311ZM12 16C9.79086 16 8 14.2091 8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12C16 14.2091 14.2091 16 12 16ZM12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z"/></svg>';

var shareFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13.5759 17.2714L8.46576 14.484C7.83312 15.112 6.96187 15.5 6 15.5C4.067 15.5 2.5 13.933 2.5 12C2.5 10.067 4.067 8.5 6 8.5C6.96181 8.5 7.83301 8.88796 8.46564 9.51593L13.5759 6.72855C13.5262 6.49354 13.5 6.24983 13.5 6C13.5 4.067 15.067 2.5 17 2.5C18.933 2.5 20.5 4.067 20.5 6C20.5 7.933 18.933 9.5 17 9.5C16.0381 9.5 15.1669 9.11201 14.5343 8.48399L9.42404 11.2713C9.47382 11.5064 9.5 11.7501 9.5 12C9.5 12.2498 9.47383 12.4935 9.42408 12.7285L14.5343 15.516C15.167 14.888 16.0382 14.5 17 14.5C18.933 14.5 20.5 16.067 20.5 18C20.5 19.933 18.933 21.5 17 21.5C15.067 21.5 13.5 19.933 13.5 18C13.5 17.7502 13.5262 17.5064 13.5759 17.2714Z"/></svg>';

var shareLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13.1202 17.0228L8.92129 14.7324C8.19135 15.5125 7.15261 16 6 16C3.79086 16 2 14.2091 2 12C2 9.79086 3.79086 8 6 8C7.15255 8 8.19125 8.48746 8.92118 9.26746L13.1202 6.97713C13.0417 6.66441 13 6.33707 13 6C13 3.79086 14.7909 2 17 2C19.2091 2 21 3.79086 21 6C21 8.20914 19.2091 10 17 10C15.8474 10 14.8087 9.51251 14.0787 8.73246L9.87977 11.0228C9.9583 11.3355 10 11.6629 10 12C10 12.3371 9.95831 12.6644 9.87981 12.9771L14.0788 15.2675C14.8087 14.4875 15.8474 14 17 14C19.2091 14 21 15.7909 21 18C21 20.2091 19.2091 22 17 22C14.7909 22 13 20.2091 13 18C13 17.6629 13.0417 17.3355 13.1202 17.0228ZM6 14C7.10457 14 8 13.1046 8 12C8 10.8954 7.10457 10 6 10C4.89543 10 4 10.8954 4 12C4 13.1046 4.89543 14 6 14ZM17 8C18.1046 8 19 7.10457 19 6C19 4.89543 18.1046 4 17 4C15.8954 4 15 4.89543 15 6C15 7.10457 15.8954 8 17 8ZM17 20C18.1046 20 19 19.1046 19 18C19 16.8954 18.1046 16 17 16C15.8954 16 15 16.8954 15 18C15 19.1046 15.8954 20 17 20Z"/></svg>';

var shieldCheckFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 1L20.2169 2.82598C20.6745 2.92766 21 3.33347 21 3.80217V13.7889C21 15.795 19.9974 17.6684 18.3282 18.7812L12 23L5.6718 18.7812C4.00261 17.6684 3 15.795 3 13.7889V3.80217C3 3.33347 3.32553 2.92766 3.78307 2.82598L12 1ZM16.4524 8.22183L11.5019 13.1709L8.67421 10.3431L7.25999 11.7574L11.5026 16L17.8666 9.63604L16.4524 8.22183Z"/></svg>';

var shieldCheckLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 1L20.2169 2.82598C20.6745 2.92766 21 3.33347 21 3.80217V13.7889C21 15.795 19.9974 17.6684 18.3282 18.7812L12 23L5.6718 18.7812C4.00261 17.6684 3 15.795 3 13.7889V3.80217C3 3.33347 3.32553 2.92766 3.78307 2.82598L12 1ZM12 3.04879L5 4.60434V13.7889C5 15.1263 5.6684 16.3752 6.7812 17.1171L12 20.5963L17.2188 17.1171C18.3316 16.3752 19 15.1263 19 13.7889V4.60434L12 3.04879ZM16.4524 8.22183L17.8666 9.63604L11.5026 16L7.25999 11.7574L8.67421 10.3431L11.5019 13.1709L16.4524 8.22183Z"/></svg>';

var sortAsc = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M19 3L23 8H20V20H18V8H15L19 3ZM14 18V20H3V18H14ZM14 11V13H3V11H14ZM12 4V6H3V4H12Z"/></svg>';

var sortDesc = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M20 4V16H23L19 21L15 16H18V4H20ZM12 18V20H3V18H12ZM14 11V13H3V11H14ZM14 4V6H3V4H14Z"/></svg>';

var starFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.0006 18.26L4.94715 22.2082L6.52248 14.2799L0.587891 8.7918L8.61493 7.84006L12.0006 0.5L15.3862 7.84006L23.4132 8.7918L17.4787 14.2799L19.054 22.2082L12.0006 18.26Z"/></svg>';

var starLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12.0006 18.26L4.94715 22.2082L6.52248 14.2799L0.587891 8.7918L8.61493 7.84006L12.0006 0.5L15.3862 7.84006L23.4132 8.7918L17.4787 14.2799L19.054 22.2082L12.0006 18.26ZM12.0006 15.968L16.2473 18.3451L15.2988 13.5717L18.8719 10.2674L14.039 9.69434L12.0006 5.27502L9.96214 9.69434L5.12921 10.2674L8.70231 13.5717L7.75383 18.3451L12.0006 15.968Z"/></svg>';

var stopLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M7 7V17H17V7H7ZM6 5H18C18.5523 5 19 5.44772 19 6V18C19 18.5523 18.5523 19 18 19H6C5.44772 19 5 18.5523 5 18V6C5 5.44772 5.44772 5 6 5Z"/></svg>';

var subtractLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M5 11V13H19V11H5Z"/></svg>';

var teamFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 10C14.2091 10 16 8.20914 16 6 16 3.79086 14.2091 2 12 2 9.79086 2 8 3.79086 8 6 8 8.20914 9.79086 10 12 10ZM5.5 13C6.88071 13 8 11.8807 8 10.5 8 9.11929 6.88071 8 5.5 8 4.11929 8 3 9.11929 3 10.5 3 11.8807 4.11929 13 5.5 13ZM21 10.5C21 11.8807 19.8807 13 18.5 13 17.1193 13 16 11.8807 16 10.5 16 9.11929 17.1193 8 18.5 8 19.8807 8 21 9.11929 21 10.5ZM12 11C14.7614 11 17 13.2386 17 16V22H7V16C7 13.2386 9.23858 11 12 11ZM5 15.9999C5 15.307 5.10067 14.6376 5.28818 14.0056L5.11864 14.0204C3.36503 14.2104 2 15.6958 2 17.4999V21.9999H5V15.9999ZM22 21.9999V17.4999C22 15.6378 20.5459 14.1153 18.7118 14.0056 18.8993 14.6376 19 15.307 19 15.9999V21.9999H22Z"/></svg>';

var teamLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 11C14.7614 11 17 13.2386 17 16V22H15V16C15 14.4023 13.7511 13.0963 12.1763 13.0051L12 13C10.4023 13 9.09634 14.2489 9.00509 15.8237L9 16V22H7V16C7 13.2386 9.23858 11 12 11ZM5.5 14C5.77885 14 6.05009 14.0326 6.3101 14.0942C6.14202 14.594 6.03873 15.122 6.00896 15.6693L6 16L6.0007 16.0856C5.88757 16.0456 5.76821 16.0187 5.64446 16.0069L5.5 16C4.7203 16 4.07955 16.5949 4.00687 17.3555L4 17.5V22H2V17.5C2 15.567 3.567 14 5.5 14ZM18.5 14C20.433 14 22 15.567 22 17.5V22H20V17.5C20 16.7203 19.4051 16.0796 18.6445 16.0069L18.5 16C18.3248 16 18.1566 16.03 18.0003 16.0852L18 16C18 15.3343 17.8916 14.694 17.6915 14.0956C17.9499 14.0326 18.2211 14 18.5 14ZM5.5 8C6.88071 8 8 9.11929 8 10.5C8 11.8807 6.88071 13 5.5 13C4.11929 13 3 11.8807 3 10.5C3 9.11929 4.11929 8 5.5 8ZM18.5 8C19.8807 8 21 9.11929 21 10.5C21 11.8807 19.8807 13 18.5 13C17.1193 13 16 11.8807 16 10.5C16 9.11929 17.1193 8 18.5 8ZM5.5 10C5.22386 10 5 10.2239 5 10.5C5 10.7761 5.22386 11 5.5 11C5.77614 11 6 10.7761 6 10.5C6 10.2239 5.77614 10 5.5 10ZM18.5 10C18.2239 10 18 10.2239 18 10.5C18 10.7761 18.2239 11 18.5 11C18.7761 11 19 10.7761 19 10.5C19 10.2239 18.7761 10 18.5 10ZM12 2C14.2091 2 16 3.79086 16 6C16 8.20914 14.2091 10 12 10C9.79086 10 8 8.20914 8 6C8 3.79086 9.79086 2 12 2ZM12 4C10.8954 4 10 4.89543 10 6C10 7.10457 10.8954 8 12 8C13.1046 8 14 7.10457 14 6C14 4.89543 13.1046 4 12 4Z"/></svg>';

var timeFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM13 12V7H11V14H17V12H13Z"/></svg>';

var timeLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM13 12H17V14H11V7H13V12Z"/></svg>';

var uploadFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 19H21V21H3V19ZM13 10V18H11V10H4L12 2L20 10H13Z"/></svg>';

var uploadLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M3 19H21V21H3V19ZM13 5.82843V17H11V5.82843L4.92893 11.8995L3.51472 10.4853L12 2L20.4853 10.4853L19.0711 11.8995L13 5.82843Z"/></svg>';

var userAddFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 14.252V22H4C4 17.5817 7.58172 14 12 14C12.6906 14 13.3608 14.0875 14 14.252ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM18 17V14H20V17H23V19H20V22H18V19H15V17H18Z"/></svg>';

var userAddLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 14.252V16.3414C13.3744 16.1203 12.7013 16 12 16C8.68629 16 6 18.6863 6 22H4C4 17.5817 7.58172 14 12 14C12.6906 14 13.3608 14.0875 14 14.252ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11ZM18 17V14H20V17H23V19H20V22H18V19H15V17H18Z"/></svg>';

var userFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4 22C4 17.5817 7.58172 14 12 14C16.4183 14 20 17.5817 20 22H4ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13Z"/></svg>';

var userFollowFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M13 14.0619V22H4C4 17.5817 7.58172 14 12 14C12.3387 14 12.6724 14.021 13 14.0619ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM17.7929 19.9142L21.3284 16.3787L22.7426 17.7929L17.7929 22.7426L14.2574 19.2071L15.6716 17.7929L17.7929 19.9142Z"/></svg>';

var userFollowLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 14.252V16.3414C13.3744 16.1203 12.7013 16 12 16C8.68629 16 6 18.6863 6 22H4C4 17.5817 7.58172 14 12 14C12.6906 14 13.3608 14.0875 14 14.252ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11ZM17.7929 19.9142L21.3284 16.3787L22.7426 17.7929L17.7929 22.7426L14.2574 19.2071L15.6716 17.7929L17.7929 19.9142Z"/></svg>';

var userLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M4 22C4 17.5817 7.58172 14 12 14C16.4183 14 20 17.5817 20 22H18C18 18.6863 15.3137 16 12 16C8.68629 16 6 18.6863 6 22H4ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11Z"/></svg>';

var userSearchFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 14V22H4C4 17.5817 7.58172 14 12 14ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM21.4462 20.032L22.9497 21.5355L21.5355 22.9497L20.032 21.4462C19.4365 21.7981 18.7418 22 18 22C15.7909 22 14 20.2091 14 18C14 15.7909 15.7909 14 18 14C20.2091 14 22 15.7909 22 18C22 18.7418 21.7981 19.4365 21.4462 20.032ZM18 20C19.1046 20 20 19.1046 20 18C20 16.8954 19.1046 16 18 16C16.8954 16 16 16.8954 16 18C16 19.1046 16.8954 20 18 20Z"/></svg>';

var userSearchLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 14V16C8.68629 16 6 18.6863 6 22H4C4 17.5817 7.58172 14 12 14ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11ZM21.4462 20.032L22.9497 21.5355L21.5355 22.9497L20.032 21.4462C19.4365 21.7981 18.7418 22 18 22C15.7909 22 14 20.2091 14 18C14 15.7909 15.7909 14 18 14C20.2091 14 22 15.7909 22 18C22 18.7418 21.7981 19.4365 21.4462 20.032ZM18 20C19.1046 20 20 19.1046 20 18C20 16.8954 19.1046 16 18 16C16.8954 16 16 16.8954 16 18C16 19.1046 16.8954 20 18 20Z"/></svg>';

var userSettingsFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 14V22H4C4 17.5817 7.58172 14 12 14ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM14.5946 18.8115C14.5327 18.5511 14.5 18.2794 14.5 18C14.5 17.7207 14.5327 17.449 14.5945 17.1886L13.6029 16.6161L14.6029 14.884L15.5952 15.4569C15.9883 15.0851 16.4676 14.8034 17 14.6449V13.5H19V14.6449C19.5324 14.8034 20.0116 15.0851 20.4047 15.4569L21.3971 14.8839L22.3972 16.616L21.4055 17.1885C21.4673 17.449 21.5 17.7207 21.5 18C21.5 18.2793 21.4673 18.551 21.4055 18.8114L22.3972 19.3839L21.3972 21.116L20.4048 20.543C20.0117 20.9149 19.5325 21.1966 19.0001 21.355V22.5H17.0001V21.3551C16.4677 21.1967 15.9884 20.915 15.5953 20.5431L14.603 21.1161L13.6029 19.384L14.5946 18.8115ZM18 17C17.4477 17 17 17.4477 17 18C17 18.5523 17.4477 19 18 19C18.5523 19 19 18.5523 19 18C19 17.4477 18.5523 17 18 17Z"/></svg>';

var userSettingsLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 14V16C8.68629 16 6 18.6863 6 22H4C4 17.5817 7.58172 14 12 14ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11ZM14.5946 18.8115C14.5327 18.5511 14.5 18.2794 14.5 18C14.5 17.7207 14.5327 17.449 14.5945 17.1886L13.6029 16.6161L14.6029 14.884L15.5952 15.4569C15.9883 15.0851 16.4676 14.8034 17 14.6449V13.5H19V14.6449C19.5324 14.8034 20.0116 15.0851 20.4047 15.4569L21.3971 14.8839L22.3972 16.616L21.4055 17.1885C21.4673 17.449 21.5 17.7207 21.5 18C21.5 18.2793 21.4673 18.551 21.4055 18.8114L22.3972 19.3839L21.3972 21.116L20.4048 20.543C20.0117 20.9149 19.5325 21.1966 19.0001 21.355V22.5H17.0001V21.3551C16.4677 21.1967 15.9884 20.915 15.5953 20.5431L14.603 21.1161L13.6029 19.384L14.5946 18.8115ZM18 19.5C18.8284 19.5 19.5 18.8284 19.5 18C19.5 17.1716 18.8284 16.5 18 16.5C17.1716 16.5 16.5 17.1716 16.5 18C16.5 18.8284 17.1716 19.5 18 19.5Z"/></svg>';

var userSharedFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 14.252V22H4C4 17.5817 7.58172 14 12 14C12.6906 14 13.3608 14.0875 14 14.252ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM18.5858 17L16.7574 15.1716L18.1716 13.7574L22.4142 18L18.1716 22.2426L16.7574 20.8284L18.5858 19H15V17H18.5858Z"/></svg>';

var userSharedLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 14.252V16.3414C13.3744 16.1203 12.7013 16 12 16C8.68629 16 6 18.6863 6 22H4C4 17.5817 7.58172 14 12 14C12.6906 14 13.3608 14.0875 14 14.252ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11ZM18.5858 17L16.7574 15.1716L18.1716 13.7574L22.4142 18L18.1716 22.2426L16.7574 20.8284L18.5858 19H15V17H18.5858Z"/></svg>';

var userUnfollowFill = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 14.252V22H4C4 17.5817 7.58172 14 12 14C12.6906 14 13.3608 14.0875 14 14.252ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM19 16.5858L21.1213 14.4645L22.5355 15.8787L20.4142 18L22.5355 20.1213L21.1213 21.5355L19 19.4142L16.8787 21.5355L15.4645 20.1213L17.5858 18L15.4645 15.8787L16.8787 14.4645L19 16.5858Z"/></svg>';

var userUnfollowLine = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M14 14.252V16.3414C13.3744 16.1203 12.7013 16 12 16C8.68629 16 6 18.6863 6 22H4C4 17.5817 7.58172 14 12 14C12.6906 14 13.3608 14.0875 14 14.252ZM12 13C8.685 13 6 10.315 6 7C6 3.685 8.685 1 12 1C15.315 1 18 3.685 18 7C18 10.315 15.315 13 12 13ZM12 11C14.21 11 16 9.21 16 7C16 4.79 14.21 3 12 3C9.79 3 8 4.79 8 7C8 9.21 9.79 11 12 11ZM19 17.5858L21.1213 15.4645L22.5355 16.8787L20.4142 19L22.5355 21.1213L21.1213 22.5355L19 20.4142L16.8787 22.5355L15.4645 21.1213L17.5858 19L15.4645 16.8787L16.8787 15.4645L19 17.5858Z"/></svg>';

const REMIXICON_CORE = {
    "account-circle-fill": accountCircleFill,
    "account-circle-line": accountCircleLine,
    "add-circle-fill": addCircleFill,
    "add-circle-line": addCircleLine,
    "add-line": addLine,
    "admin-fill": adminFill,
    "admin-line": adminLine,
    "alert-fill": alertFill,
    "alert-line": alertLine,
    "arrow-down-line": arrowDownLine,
    "arrow-down-s-line": arrowDownSLine,
    "arrow-go-back-line": arrowGoBackLine,
    "arrow-go-forward-line": arrowGoForwardLine,
    "arrow-left-line": arrowLeftLine,
    "arrow-left-s-line": arrowLeftSLine,
    "arrow-right-line": arrowRightLine,
    "arrow-right-s-line": arrowRightSLine,
    "arrow-up-line": arrowUpLine,
    "arrow-up-s-line": arrowUpSLine,
    "attachment-line": attachmentLine,
    "calendar-fill": calendarFill,
    "calendar-line": calendarLine,
    "chat-1-fill": chat1Fill,
    "chat-1-line": chat1Line,
    "check-fill": checkFill,
    "check-line": checkLine,
    "checkbox-circle-fill": checkboxCircleFill,
    "checkbox-circle-line": checkboxCircleLine,
    "clipboard-line": clipboardLine,
    "close-circle-fill": closeCircleFill,
    "close-circle-line": closeCircleLine,
    "close-line": closeLine,
    "contacts-book-fill": contactsBookFill,
    "contacts-book-line": contactsBookLine,
    "contacts-fill": contactsFill,
    "contacts-line": contactsLine,
    "dashboard-fill": dashboardFill,
    "dashboard-line": dashboardLine,
    "delete-bin-fill": deleteBinFill,
    "delete-bin-line": deleteBinLine,
    "discuss-fill": discussFill,
    "discuss-line": discussLine,
    "download-fill": downloadFill,
    "download-line": downloadLine,
    "edit-2-line": edit2Line,
    "edit-line": editLine,
    "error-warning-fill": errorWarningFill,
    "error-warning-line": errorWarningLine,
    "external-link-line": externalLinkLine,
    "eye-fill": eyeFill,
    "eye-line": eyeLine,
    "eye-off-line": eyeOffLine,
    "feedback-fill": feedbackFill,
    "feedback-line": feedbackLine,
    "file-add-line": fileAddLine,
    "file-copy-line": fileCopyLine,
    "file-download-line": fileDownloadLine,
    "file-line": fileLine,
    "file-text-line": fileTextLine,
    "file-upload-line": fileUploadLine,
    "filter-fill": filterFill,
    "filter-line": filterLine,
    "folder-line": folderLine,
    "folder-open-line": folderOpenLine,
    "fullscreen-exit-line": fullscreenExitLine,
    "fullscreen-line": fullscreenLine,
    "group-fill": groupFill,
    "group-line": groupLine,
    "heart-fill": heartFill,
    "heart-line": heartLine,
    "home-fill": homeFill,
    "home-line": homeLine,
    "information-fill": informationFill,
    "information-line": informationLine,
    link: link,
    "link-unlink": linkUnlink,
    "loader-fill": loaderFill,
    "loader-line": loaderLine,
    "lock-fill": lockFill,
    "lock-line": lockLine,
    "lock-unlock-line": lockUnlockLine,
    "login-box-line": loginBoxLine,
    "logout-box-line": logoutBoxLine,
    "logout-box-r-line": logoutBoxRLine,
    "mail-fill": mailFill,
    "mail-line": mailLine,
    "menu-fill": menuFill,
    "menu-line": menuLine,
    "message-fill": messageFill,
    "message-line": messageLine,
    "more-2-line": more2Line,
    "more-fill": moreFill,
    "more-line": moreLine,
    "notification-fill": notificationFill,
    "notification-line": notificationLine,
    "pause-line": pauseLine,
    "phone-fill": phoneFill,
    "phone-line": phoneLine,
    "play-line": playLine,
    "question-fill": questionFill,
    "question-line": questionLine,
    "refresh-line": refreshLine,
    "save-fill": saveFill,
    "save-line": saveLine,
    "search-eye-line": searchEyeLine,
    "search-line": searchLine,
    "settings-3-line": settings3Line,
    "settings-fill": settingsFill,
    "settings-line": settingsLine,
    "share-fill": shareFill,
    "share-line": shareLine,
    "shield-check-fill": shieldCheckFill,
    "shield-check-line": shieldCheckLine,
    "sort-asc": sortAsc,
    "sort-desc": sortDesc,
    "star-fill": starFill,
    "star-line": starLine,
    "stop-line": stopLine,
    "subtract-line": subtractLine,
    "team-fill": teamFill,
    "team-line": teamLine,
    "time-fill": timeFill,
    "time-line": timeLine,
    "upload-fill": uploadFill,
    "upload-line": uploadLine,
    "user-add-fill": userAddFill,
    "user-add-line": userAddLine,
    "user-fill": userFill,
    "user-follow-fill": userFollowFill,
    "user-follow-line": userFollowLine,
    "user-line": userLine,
    "user-search-fill": userSearchFill,
    "user-search-line": userSearchLine,
    "user-settings-fill": userSettingsFill,
    "user-settings-line": userSettingsLine,
    "user-shared-fill": userSharedFill,
    "user-shared-line": userSharedLine,
    "user-unfollow-fill": userUnfollowFill,
    "user-unfollow-line": userUnfollowLine
};

const iconSources = new Map([ [ "remixicon", REMIXICON_CORE ] ]);

function registerIcons(sourceName, icons) {
    if (!sourceName || typeof sourceName !== "string") throw new SystemError("InvalidArgument", "registerIcons() expects a non-empty source name.");
    if (!icons || typeof icons !== "object" || Array.isArray(icons) || Object.keys(icons).length === 0) throw new SystemError("InvalidArgument", "registerIcons() expects a non-empty icon set.");
    iconSources.set(sourceName, icons);
}

function getIcon(iconName) {
    const sources = [ ...iconSources.values() ].reverse();
    for (const source of sources) {
        if (iconName in source) return source[iconName];
    }
    throw new SystemError("Unrecognized", `Unable to find the icon: ${iconName}.`);
}

function listIcons() {
    let total = 0;
    for (const [name, source] of iconSources) {
        const keys = Object.keys(source);
        total += keys.length;
        console.groupCollapsed(`${name} (${keys.length} icons)`);
        console.log(keys.sort().join(", "));
        console.groupEnd();
    }
    console.log(`Total: ${total} icons across ${iconSources.size} source(s)`);
}

class Container extends HTMDElement {
    constructor(children, props) {
        super(children, props);
        this._tag = props?.as ?? "div";
        this.selectableItems = props?.selectableItems ?? false;
        this.onClickHandler = props?.onClickHandler ?? (() => {});
    }
    get _modifierClasses() {
        const mods = [];
        if (!/^container$/.test(this.name)) mods.push(`${LIB_PREFIX}__container`);
        if (this.selectableItems) mods.push(`${this.topClassBEM}--selectable-items`);
        return mods.join(" ");
    }
    toString() {
        return `<${this._tag}\n                      id="${this.id}"\n                      class="${this.class} ${this._modifierClasses}"\n                          tabindex='-1'\n                  ></${this._tag}>`;
    }
    set onClickHandler(callback) {
        this.setEventHandler("click", callback);
    }
}

class AccordionItem extends Container {
    constructor(header, children, props) {
        super(children, {
            class: props?.class ?? "",
            id: props?.id,
            containerSelector: props?.containerSelector
        });
        this._isOpen = props?.isInitialOpen ?? false;
        this._header = header;
        this._onOpenCallback = props?.onOpenCallback || (() => {});
        this.onCloseCallback = props?.onCloseCallback || (() => {});
    }
    get _modifierClasses() {
        const mods = [ super._modifierClasses ];
        if (this._isOpen) mods.push(`${this.topClassBEM}--open`);
        return mods.join(" ");
    }
    _createIcon() {
        return `<span class="${this.topClassBEM}__header__icon">${getIcon("arrow-down-s-line")}</span>`;
    }
    _createHeader() {
        return `<div class="${this.topClassBEM}__header">` + `<span class="${this.topClassBEM}__header__content">${escapeHtml(this._header)}</span>` + this._createIcon() + `</div>`;
    }
    _createBody() {
        return `<div class="${this.topClassBEM}__body"><div class="${this.topClassBEM}__content"></div></div>`;
    }
    toString() {
        const tag = this._tag;
        const id = this.id;
        const cls = `${this.class} ${this._modifierClasses}`;
        return `<${tag} id="${id}" class="${cls}" tabindex='-1'>` + this._createHeader() + this._createBody() + `</${tag}>`;
    }
    render() {
        super.render(true, {
            childrenContainerSelector: `.${this.topClassBEM}__content`
        });
    }
    _handleAccordionToggle() {
        if (this._isOpen) this.onCloseCallback(); else this._onOpenCallback();
        this._isOpen = !this._isOpen;
        if (this._isOpen) this.instance?.addClass(`${this.topClassBEM}--open`); else this.instance?.removeClass(`${this.topClassBEM}--open`);
    }
    _containerToggleEventListener() {
        const header = this.instance?.children(`.${this.topClassBEM}__header`);
        header?.on("click", () => this._handleAccordionToggle());
    }
    close() {
        if (!this._isOpen) return;
        this._isOpen = false;
        this.instance?.removeClass(`${this.topClassBEM}--open`);
        this.onCloseCallback();
    }
    open() {
        if (this._isOpen) return;
        this._isOpen = true;
        this.instance?.addClass(`${this.topClassBEM}--open`);
        this._onOpenCallback();
    }
    toggle() {
        this._handleAccordionToggle();
    }
    get isOpen() {
        return this._isOpen;
    }
    _setOpenCallback(cb) {
        this._onOpenCallback = cb;
    }
    _applyEventListeners() {
        super._applyEventListeners();
        this._containerToggleEventListener();
    }
}

class AccordionGroup extends Container {
    constructor(children, props) {
        super("", props);
        if (!Array.isArray(children) || some(children, item => !(item instanceof AccordionItem))) throw new SystemError("Invalid children", "AccordionGroup expects an array of AccordionItems");
        this._children = map(children, (item, index) => {
            item._setOpenCallback(() => this._closeAllOtherItems(index));
            return item;
        });
        this.allowMultipleOpen = props?.allowMultipleOpen ?? false;
        const {openIndex: openIndex} = props ?? {};
        if (openIndex !== undefined && openIndex >= 0 && openIndex < this._children.length) {
            this._children[openIndex].open();
        }
    }
    _closeAllOtherItems(index) {
        if (this.allowMultipleOpen) return;
        forEach(this._children, (item, i) => {
            if (i !== index) {
                item.close();
            }
        });
    }
}

class Card extends Container {
    constructor(children, props) {
        super(children, props);
        this.variant = props?.variant || "primary";
    }
    get _modifierClasses() {
        const superMods = [ super._modifierClasses ];
        superMods.push(`${this.topClassBEM}--${this.variant}`);
        return superMods.join(" ");
    }
}

class Fragment {
    constructor(children, props) {
        this._children = children;
        this._containerSelector = props?.containerSelector;
        this.isHTMD = true;
    }
    get [Symbol.toStringTag]() {
        return "Fragment";
    }
    _renderChild(child) {
        if (!isHTMDComponent(child)) throw new SystemError("Invalid child", "Fragment received a child that does not implement HTMDElementInterface. Only SPARC components are valid Fragment children.");
        if (this._containerSelector) child.containerSelector = this._containerSelector;
        child.render();
    }
    render() {
        forEach(this._children, child => this._renderChild(child));
    }
    remove() {
        forEach(this._children, child => child?.remove());
    }
    toString() {
        let str = "";
        forEach(this._children, e => str += e.toString());
        return str;
    }
    get children() {
        return this._children;
    }
    get containerSelector() {
        return this._containerSelector;
    }
    set children(children) {
        this.remove();
        this._children = children;
        this.render();
    }
    set containerSelector(selector) {
        this.remove();
        this._containerSelector = selector;
    }
}

const DISABLE_SCROLL_CLASS = `${LIB_PREFIX}__disable-scroll`;

class Modal extends Container {
    constructor(children, props) {
        super(children, props);
        this.backdrop = props?.backdrop ?? true;
        this._isOpen = false;
        this.closeOnFocusLoss = props?.closeOnFocusLoss ?? true;
        this._onCloseHandler = props?.onCloseHandler || (() => {});
        this._onOpenHandler = props?.onOpenHandler || (() => {});
    }
    render() {
        super.render();
    }
    open() {
        this._isOpen = true;
        this._onOpenHandler();
        this.instance?.addClass(`${this.topClassBEM}--open`);
        if (this.backdrop) this.instance?.addClass(`${this.topClassBEM}--backdrop`);
        $(this._containerSelector).addClass(DISABLE_SCROLL_CLASS);
        clearTimeout(this.instance?.data(`${LIB_PREFIX}-blurTimeout`));
        this.instance?.trigger("focus");
    }
    close() {
        this._isOpen = false;
        this._onCloseHandler();
        this.instance?.removeClass(`${this.topClassBEM}--open`);
        this.instance?.removeClass(`${this.topClassBEM}--backdrop`);
        $(this._containerSelector).removeClass(DISABLE_SCROLL_CLASS);
    }
    remove() {
        this._clearBlurTimeout();
        if (this._isOpen) {
            this.instance?.removeClass(`${this.topClassBEM}--open`);
            this.instance?.removeClass(`${this.topClassBEM}--backdrop`);
            $(this._containerSelector).removeClass(DISABLE_SCROLL_CLASS);
            this._isOpen = false;
        }
        super.remove();
    }
    _clearBlurTimeout() {
        const stored = this.instance?.data(`${LIB_PREFIX}-blurTimeout`);
        if (stored != null) {
            clearTimeout(stored);
            this.instance?.removeData(`${LIB_PREFIX}-blurTimeout`);
        }
    }
    _onFocusLossEventListener() {
        this._addManagedListener("focusout", () => {
            const timeout = setTimeout(() => {
                const active = document.activeElement;
                if (!this.instance?.[0].contains(active)) {
                    this.close();
                }
            }, 0);
            this.instance?.data(`${LIB_PREFIX}-blurTimeout`, timeout);
        });
    }
    _onEscapeKeyListener() {
        this._addManagedListener("keydown", e => {
            if (e.originalEvent?.key === "Escape") {
                this.close();
            }
        });
    }
    _applyEventListeners() {
        super._applyEventListeners();
        this._onEscapeKeyListener();
        if (this.closeOnFocusLoss) this._onFocusLossEventListener();
    }
    get _modifierClasses() {
        const superMods = super._modifierClasses;
        const parts = superMods ? [ superMods ] : [];
        if (this._isOpen) parts.push(`${this.topClassBEM}--open`);
        return parts.filter(Boolean).join(" ");
    }
    set onCloseHandler(callback) {
        this._onCloseHandler = callback;
    }
    set onOpenHandler(callback) {
        this._onOpenHandler = callback;
    }
    get isVisible() {
        return this.instance?.hasClass(`${this.topClassBEM}--open`);
    }
}

class SidePanel extends Modal {
    constructor(props) {
        const containerSelector = props?.containerSelector || "#root";
        const defaults = {
            ...props,
            backdrop: props?.backdrop ?? true,
            closeOnFocusLoss: props?.closeOnFocusLoss ?? true,
            containerSelector: containerSelector
        };
        super([], defaults);
        this._title = props?.title || "";
        this._width = props?.width || "400px";
        const children = [ new Card(props.content, {
            class: `${this.topClassBEM}__content`
        }) ];
        if (props?.footer) {
            children.push(new Card(props.footer, {
                class: `${this.topClassBEM}__footer`
            }));
        }
        this._children = children;
    }
    get _modifierClasses() {
        const mods = [];
        if (this._isOpen) mods.push(`${this.topClassBEM}--open`);
        return mods.join(" ");
    }
    render() {
        if (!$(this._containerSelector).length) {
            console.warn(`[SidePanel] containerSelector "${this._containerSelector}" not found in DOM. Panel will not render.`);
        }
        super.render();
    }
    toString() {
        return `\n      <div\n        id="${this.id}"\n        class="${this.class} ${this._modifierClasses}"\n        style="width: ${this._width}"\n        tabindex="-1"\n      >\n        <div class="${this.topClassBEM}__header-bar">\n          <h2 class="${this.topClassBEM}__title">${escapeHtml(this._title)}</h2>\n          <button class="${this.topClassBEM}__close-btn" type="button" aria-label="Close">\n            ${getIcon("close-line")}\n          </button>\n        </div>\n      </div>\n    `;
    }
    _applyEventListeners() {
        super._applyEventListeners();
        this._addManagedListener("click", () => this.close(), `.${this.topClassBEM}__close-btn`);
    }
    get title() {
        return this._title;
    }
    set title(value) {
        this._title = value;
        this.instance?.find(`.${this.topClassBEM}__title`).text(value);
    }
    get width() {
        return this._width;
    }
    set width(value) {
        this._width = value;
        this.instance?.css("width", value);
    }
}

class View extends HTMDElement {
    constructor(children, props) {
        super(children, props);
        this._hiding = false;
        this._onRefresh = props?.onRefreshHandler ?? (() => {});
        this.showOnRender = props?.showOnRender ?? true;
    }
    toString() {
        return `<section\n                    style="display:none;"\n                    id="${this.id}"\n                    class="${this.class}"\n                          tabindex='-1'\n                    ></section>`;
    }
    render(show = this.showOnRender) {
        super.render();
        if (show) this.show();
    }
    hide(duration = 400, onCompleteCallback) {
        if (!this._hiding) {
            this._hiding = true;
            this.instance?.css("pointer-events", "none");
        }
        return new Promise(resolve => {
            this.instance?.stop(true, true).fadeOut(duration, () => {
                this._hiding = false;
                this.instance?.css("pointer-events", "");
                onCompleteCallback?.();
                resolve();
            });
        });
    }
    async show(duration = 400, onCompleteCallback) {
        await this._onRefresh();
        return new Promise(resolve => {
            this.instance?.stop(true, true).fadeIn(duration, () => {
                onCompleteCallback?.();
                resolve();
            });
        });
    }
    toggleVisibility(duration = 400, onCompleteCallback) {
        this[this.isVisible ? "hide" : "show"](duration, () => onCompleteCallback?.());
    }
    get isVisible() {
        return this.instance?.is(":visible");
    }
    get isHiding() {
        return this._hiding;
    }
    set children(children) {
        const wasActive = this.isVisible;
        super.children = children;
        if (wasActive) {
            this.instance?.css("display", "");
            this._onRefresh();
        }
    }
    get children() {
        return super.children;
    }
}

class ViewSwitcher extends Fragment {
    constructor(children, props) {
        super([], props);
        this._switching = false;
        this.next = () => {
            const len = this._children.length;
            const newIndex = this.currentViewIndex + 1 === len ? 0 : this.currentViewIndex + 1;
            this.setViewByIndex(newIndex);
        };
        this.previous = () => {
            const len = this._children.length;
            const newIndex = this.currentViewIndex === 0 ? len - 1 : this.currentViewIndex - 1;
            this.setViewByIndex(newIndex);
        };
        this._viewKeys = {};
        this._children = [];
        this._onRefreshHandler = props?.onRefreshHandler ?? (() => {});
        forEach(children, ([key, child], index) => {
            this._children.push(child);
            this._viewKeys[key] = index;
        });
        this._currentViewName = props?.selectedViewName || children?.[0]?.[0];
        this._currentChild = this._children[this._viewKeys[this._currentViewName]];
    }
    get [Symbol.toStringTag]() {
        return "View Switcher";
    }
    _renderChild(child) {
        if (!(child instanceof View)) return;
        if (this._containerSelector) child.containerSelector = this._containerSelector;
        child.render(false);
    }
    render() {
        super.render();
        if (this?.currentChild) this.currentChild?.show();
    }
    addViews(...views) {
        forEach(views, ([key, view]) => {
            this._children = [ ...this._children, view ];
            this._viewKeys[key] = this._children.length - 1;
        });
        if (!this.currentChild) {
            this._currentViewName = views?.[0]?.[0];
            this._currentChild = this._children[this._viewKeys[this._currentViewName]];
        }
    }
    setView(viewName) {
        if (this._switching) return;
        const oldChild = this._currentChild;
        this._currentViewName = viewName;
        this._currentChild = this._children[this._viewKeys[viewName]];
        if (oldChild === this._currentChild) {
            this._onRefreshHandler(viewName, this._viewKeys[viewName], this._currentChild);
            return;
        }
        this._switching = true;
        oldChild?.hide(400).then(() => {
            this._switching = false;
            this._currentChild.show();
            this._onRefreshHandler(viewName, this._viewKeys[viewName], this._currentChild);
        });
    }
    setViewByIndex(n) {
        const entry = Object.entries(this._viewKeys).find(([_, i]) => i === n);
        if (!entry) {
            throw new SystemError("ViewSwitcher", "View index is out of bounds", {
                breaksFlow: false
            });
        } else this.setView(entry[0]);
    }
    get currentChild() {
        return this._currentChild;
    }
    get currentViewName() {
        return this._currentViewName;
    }
    get currentViewIndex() {
        return this._viewKeys[this._currentViewName];
    }
}

class Text extends HTMDElement {
    constructor(children, props) {
        super(children, props);
        this.type = props?.type || "p";
        this.for = this.type === "label" ? props?.for ?? "" : "";
        this.title = props?.title ?? "";
    }
    toString() {
        return `<${this.type}\n              id="${this.id}"\n              class="${this.class}"\n              ${this.type === "label" ? `for="${escapeAttr(this.for)}"` : ""}\n              ${this.title ? `title="${escapeAttr(this.title)}"` : ""}\n            ></${this.type}>`;
    }
}

class Dialog extends Modal {
    constructor(props) {
        super([], {
            backdrop: true,
            closeOnFocusLoss: false,
            ...props
        });
        this._variant = props?.variant || "info";
        this.children = [ new Card([ getIconFromVariant(props.variant), new Text(props?.title, {
            type: "h2"
        }) ], {
            variant: "secondary",
            class: `${this.topClassBEM}__header`
        }), new Card(props.content, {
            variant: "secondary",
            class: `${this.topClassBEM}__content`
        }), new Card(props.footer, {
            variant: "secondary",
            class: `${this.topClassBEM}__footer`
        }) ];
    }
}

function getIconFromVariant(variant) {
    switch (variant) {
      case "error":
        return getIcon("error-warning-line");

      case "warning":
        return getIcon("alert-line");

      case "info":
        return getIcon("information-line");
    }
}

class Loader extends HTMDElement {
    constructor(children, props) {
        super(children, props);
        this.animation = props?.animation || "pulse";
    }
    toString() {
        return `<div id="${this.id}" ${this.animation ? `data-animation="${this.animation}"` : ""} class="${this.class}"></div>`;
    }
    enable() {
        if (!this.isAlive) {
            if (!this.containerSelector) {
                console.warn("[Loader.enable] called when not alive and containerSelector is empty -- no-op. Call render() first or set containerSelector.");
                return;
            }
            this.render();
        }
        this.instance?.addClass(`${this.topClassBEM}--active`);
    }
    disable() {
        this.instance?.removeClass(`${this.topClassBEM}--active`);
    }
    toggleLoader() {
        if (this.instance?.hasClass(`${this.topClassBEM}--active`)) {
            this.disable();
        } else {
            this.enable();
        }
    }
    remove() {
        this.disable();
        super.remove();
    }
}

const LOADING_MAX_DURATION_MS = 3e4;

class Toast {
    static _show(message, type, options = {}) {
        const defaults = type === "loading" ? {
            duration: -1,
            autoClose: false
        } : Toast._defaults[type];
        const autoClose = options.autoClose ?? defaults.autoClose;
        const baseClass = `${LIB_PREFIX}__toast`, className = `${baseClass} toastify--${type} ${options.className ?? ""}`;
        const raw = StartToastifyInstance({
            text: message,
            className: className,
            duration: autoClose ? options.duration ?? defaults.duration : -1,
            gravity: options.verticalAlign ?? "top",
            position: options.horizontalAlign ?? "right",
            stopOnFocus: options.stopOnFocus ?? true,
            close: true,
            offset: options.offset,
            callback: options.onClose ?? (() => {})
        }).showToast();
        if (raw == null || typeof raw.hideToast !== "function") {
            console.warn("[Toast._show] toastify did not return an object with hideToast(); dismissal will be a no-op", {
                raw: raw
            });
            return {
                hideToast: () => {}
            };
        }
        return raw;
    }
    static success(message, options) {
        this._show(message, "success", options);
    }
    static error(message, options) {
        this._show(message, "error", options);
    }
    static info(message, options) {
        this._show(message, "info", options);
    }
    static warning(message, options) {
        this._show(message, "warning", options);
    }
    static loading(message, options) {
        const instance = Toast._show(message, "loading", {
            ...options,
            autoClose: false
        });
        let resolved = false;
        const resolve = (type, msg, opts) => {
            if (resolved) return;
            resolved = true;
            clearTimeout(autoCloseTimer);
            instance.hideToast();
            Toast._activeLoaders.delete(controller);
            Toast._show(msg, type, opts);
        };
        const controller = {
            success: (msg, opts) => resolve("success", msg, opts),
            error: (msg, opts) => resolve("error", msg, opts),
            dismiss: () => {
                if (resolved) return;
                resolved = true;
                clearTimeout(autoCloseTimer);
                instance.hideToast();
                Toast._activeLoaders.delete(controller);
            }
        };
        const autoCloseTimer = setTimeout(() => {
            if (!resolved) {
                console.warn("[Toast.loading] auto-dismissed after max duration -- controller was never resolved", {
                    message: message
                });
                controller.dismiss();
            }
        }, LOADING_MAX_DURATION_MS);
        Toast._activeLoaders.add(controller);
        return controller;
    }
    static dismissAll() {
        for (const loader of [ ...Toast._activeLoaders ]) {
            loader.dismiss();
        }
    }
    static promise(promise, messages, options) {
        const toast = Toast.loading(messages.loading, options);
        return promise.then(value => {
            const msg = typeof messages.success === "function" ? messages.success(value) : messages.success;
            toast.success(msg);
            return value;
        }, reason => {
            const msg = typeof messages.error === "function" ? messages.error(reason) : messages.error;
            toast.error(msg);
            throw reason;
        });
    }
}

Toast._defaults = {
    success: {
        duration: 4e3,
        autoClose: true
    },
    info: {
        duration: 5e3,
        autoClose: true
    },
    warning: {
        duration: 6e3,
        autoClose: true
    },
    error: {
        duration: 8e3,
        autoClose: true
    }
};

Toast._activeLoaders = new Set;

class Button extends FormControl {
    constructor(children, props) {
        super("button", props);
        this._throttledClick = null;
        this._children = children;
        this.type = props?.type || "button";
        this.variant = props?.variant || "primary";
        this.isOutlined = props?.isOutlined || false;
        this.isSquared = props?.squared || false;
        const throttleProp = props?.throttle;
        if (throttleProp === false) {
            this._clickThrottleMs = null;
        } else if (typeof throttleProp === "number") {
            this._clickThrottleMs = throttleProp;
        } else {
            this._clickThrottleMs = 300;
        }
        this.onClickHandler = props.onClickHandler;
    }
    get modifierClasses() {
        const mods = [];
        mods.push(`${this.topClassBEM}--${this.variant}`);
        if (this.isOutlined) mods.push(`form-control--outlined`);
        if (this.isSquared) mods.push(`${this.topClassBEM}--squared`);
        return `${super.modifierClasses} ${mods.join(" ")}`;
    }
    toString() {
        return `<button\n\t\t\t\t\ttitle="${escapeAttr(this.title)}"\n\t\t\t\t\tid="${this.id}"\n\t\t\t\t\tclass="${this.class} ${this.modifierClasses}"\n\t\t\t\t\ttype="${this.type}"\n\t\t\t\t\t${this.isDisabled || this.isLoading ? "disabled" : ""}\n\t\t\t\t></button>`;
    }
    set onClickHandler(callback) {
        this._throttledClick?.cancel();
        this._throttledClick = null;
        if (typeof callback === "function" && this._clickThrottleMs !== null) {
            this._throttledClick = throttle(callback, this._clickThrottleMs, {
                trailing: false
            });
            this.setEventHandler("click", this._throttledClick);
        } else {
            this.setEventHandler("click", callback);
        }
    }
    remove() {
        this._throttledClick?.cancel();
        super.remove();
    }
}

class ComboBox extends FormControl {
    constructor(field, dataset, props) {
        super(field, props ?? {});
        this._fuseInstance = null;
        this._focusedIndex = -1;
        this._pendingTimeouts = new Set;
        this._isLoading = false;
        this._hasError = false;
        this._searchSeq = 0;
        this._explicitlyDisabled = props?.isDisabled ?? false;
        this._dataset = this._normalizeDataset(dataset);
        this._filteredDataset = this._dataset;
        this._allowMultiple = props?.allowMultiple ?? false;
        this._placeholder = props?.placeholder ?? "Select...";
        this._onSelectHandler = props?.onSelectHandler;
        this._clearText = props?.clearText ?? "Clear...";
        this._isDropdownOpen = false;
        this._allowFiltering = props?.allowFiltering ?? true;
        this._returnFullDataset = props?.returnFullDataset ?? false;
        this._filterFn = props?.filteringFunction ?? (search => this._defaultFilteringFunction(search));
        this._allowCreate = props?.allowCreate ?? false;
        this._loadingText = props?.loadingText ?? "Searching...";
        this._noResultsText = props?.noResultsText ?? "No results found";
        this._errorText = props?.errorText ?? "Search failed";
        this._disableOnEmptyDataset();
        this._syncDatasetFromField();
        const preChecked = this._dataset.filter(e => e.checked);
        if (preChecked.length > 0) {
            this._value.value = this._allowMultiple ? preChecked : preChecked[0];
        }
    }
    _normalizeDataset(data) {
        if (data.length === 0) return [];
        if (typeof data[0] === "string") {
            return data.map(s => ({
                label: s,
                value: s
            }));
        }
        return data;
    }
    _getFuseInstance() {
        if (!this._fuseInstance) {
            this._fuseInstance = new Fuse(this._dataset, {
                minMatchCharLength: 2,
                includeScore: true,
                keys: [ {
                    name: "label",
                    weight: 2
                }, {
                    name: "value",
                    weight: 1
                } ]
            });
        }
        return this._fuseInstance;
    }
    _invalidateFuseCache() {
        this._fuseInstance = null;
    }
    _defaultFilteringFunction(search) {
        return this._getFuseInstance().search(search).map(e => e.item);
    }
    _disableOnEmptyDataset() {
        if (this._explicitlyDisabled) return;
        if (this._allowCreate) return;
        this._isDisabled = !this._dataset || this._dataset.length === 0;
    }
    _syncDatasetFromField() {
        const fieldValue = this._value.value;
        if (!fieldValue || Array.isArray(fieldValue) && fieldValue.length === 0) return;
        const selections = Array.isArray(fieldValue) ? fieldValue : [ fieldValue ];
        for (const item of this._dataset) {
            item.checked = selections.some(sel => {
                if (typeof sel === "string") return item.label === sel;
                return item.label === sel.label;
            });
        }
    }
    _trackTimeout(fn, ms) {
        const id = setTimeout(() => {
            this._pendingTimeouts.delete(id);
            fn();
        }, ms);
        this._pendingTimeouts.add(id);
        return id;
    }
    _clearAllTimeouts() {
        this._pendingTimeouts.forEach(clearTimeout);
        this._pendingTimeouts.clear();
    }
    _createSearchBar() {
        const listboxId = `${this.id}-listbox`;
        return `<div class="${this.topClassBEM}__searchbar">\n      <input\n        class="${this.topClassBEM}__searchbar__input"\n        placeholder="${escapeAttr(this._placeholder)}"\n        spellcheck="false"\n        autocomplete="off"\n        role="combobox"\n        aria-expanded="${this._isDropdownOpen}"\n        aria-haspopup="listbox"\n        aria-owns="${listboxId}"\n        aria-autocomplete="list"\n      />\n      <span class="${this.topClassBEM}__searchbar__clear" style="display:none">\n        ${getIcon("close-line")}\n      </span>\n      <span class="${this.topClassBEM}__searchbar__icon">\n        ${getIcon(this._isDropdownOpen ? "arrow-up-s-line" : "arrow-down-s-line")}\n      </span>\n    </div>`;
    }
    _createDropdown() {
        const listboxId = `${this.id}-listbox`;
        const multiAttr = this._allowMultiple ? ' aria-multiselectable="true"' : "";
        return `<div\n      class="${this.topClassBEM}__dropdown"\n      style="display:none"\n    >\n      ${this._createCreateOption()}\n      <div\n        class="${this.topClassBEM}__dropdown__list"\n        role="listbox"\n        id="${listboxId}"\n        ${multiAttr}\n      >\n        ${this._createDropdownBody()}\n      </div>\n      ${this._allowMultiple ? `<button class="${this.topClassBEM}__clear-btn">${this._clearText}</button>` : ""}\n    </div>`;
    }
    _createOption(option, index) {
        const optId = `${this.id}-opt-${index}`;
        const selectedClass = option.checked ? `${this.topClassBEM}__option--selected` : "";
        const disabledClass = option.disabled ? `${this.topClassBEM}__option--disabled` : "";
        return `<div\n      class="${this.topClassBEM}__option ${selectedClass} ${disabledClass}"\n      id="${optId}"\n      role="option"\n      data-index="${index}"\n      ${option.disabled ? 'data-disabled aria-disabled="true"' : ""}\n      aria-selected="${!!option.checked}"\n      tabindex="-1"\n    >\n      <span>${escapeHtml(option.label)}</span>\n      ${getIcon("check-line")}\n    </div>`;
    }
    _createOptionsList() {
        return this._filteredDataset.map((opt, i) => this._createOption(opt, i)).join("");
    }
    _createCreateOption() {
        if (!this._allowCreate) return "";
        return `<div class="${this.topClassBEM}__create-option" style="display:none">\n      <span class="${this.topClassBEM}__create-option__icon">${getIcon("add-line")}</span>\n      <span class="${this.topClassBEM}__create-option__text"></span>\n    </div>`;
    }
    _createDropdownBody() {
        if (this._hasError) {
            return `<div class="${this.topClassBEM}__status-row ${this.topClassBEM}__status-row--error">${escapeHtml(this._errorText)}</div>`;
        }
        if (this._isLoading) {
            const loadingRow = `<div class="${this.topClassBEM}__status-row ${this.topClassBEM}__status-row--loading"><span class="${this.topClassBEM}__status-row__spinner">${getIcon("loader-line")}</span><span>${escapeHtml(this._loadingText)}</span></div>`;
            if (this._filteredDataset.length > 0) {
                return loadingRow + this._createOptionsList();
            }
            return loadingRow;
        }
        if (this._filteredDataset.length === 0) {
            return `<div class="${this.topClassBEM}__status-row ${this.topClassBEM}__status-row--empty">${this._emptyMessage()}</div>`;
        }
        return this._createOptionsList();
    }
    _emptyMessage() {
        return escapeHtml(this._noResultsText);
    }
    _setLoading(loading) {
        if (loading === this._isLoading) return;
        this._isLoading = loading;
        if (loading) {
            this._hasError = false;
            if (!this._isDropdownOpen) this._openDropdown();
        }
        this._refreshDropdownList();
    }
    _refreshDropdownList() {
        const listEl = this.instance?.find(`.${this.topClassBEM}__dropdown__list`);
        if (!listEl) return;
        listEl.html(this._createDropdownBody());
        if (this._isLoading && this._filteredDataset.length > 0) {
            listEl.addClass(`${this.topClassBEM}__dropdown__list--refetching`);
        } else {
            listEl.removeClass(`${this.topClassBEM}__dropdown__list--refetching`);
        }
        if (!this._isLoading && !this._hasError && this._filteredDataset.length > 0) {
            this._bindOptionClickHandlers();
            this._bindKeyboardNavigation();
        }
        this._updateCreateOption();
    }
    _updateCreateOption() {
        if (!this._allowCreate) return;
        const createEl = this.instance?.find(`.${this.topClassBEM}__create-option`);
        if (!createEl?.length) return;
        const input = this.instance?.find(`.${this.topClassBEM}__searchbar__input`);
        const text = input?.val()?.toString().trim() || "";
        if (!text) {
            createEl.hide();
            return;
        }
        const exactMatch = this._filteredDataset.some(opt => opt.label.toLowerCase() === text.toLowerCase());
        if (exactMatch) {
            createEl.hide();
        } else {
            createEl.find(`.${this.topClassBEM}__create-option__text`).text(`Create "${text}"`);
            createEl.show();
        }
    }
    _refreshChevron() {
        this.instance?.find(`.${this.topClassBEM}__searchbar__icon`).html(getIcon(this._isDropdownOpen ? "arrow-up-s-line" : "arrow-down-s-line"));
    }
    _displaySelection() {
        const input = this.instance?.find(`.${this.topClassBEM}__searchbar__input`);
        const displayLabel = this._dataset.filter(opt => opt.checked).map(opt => opt.label).join(", ");
        input?.val(displayLabel);
        input?.attr("title", displayLabel || "");
        if (!this._allowMultiple) {
            const clearIcon = this.instance?.find(`.${this.topClassBEM}__searchbar__clear`);
            if (displayLabel) {
                clearIcon?.show();
            } else {
                clearIcon?.hide();
            }
        }
    }
    _selectOption(target) {
        if (!target || target.disabled) return;
        if (this._allowMultiple) {
            target.checked = !target.checked;
        } else {
            const wasChecked = target.checked;
            this._dataset.forEach(o => {
                o.checked = false;
            });
            target.checked = !wasChecked;
        }
        this._afterSelection();
        this._onSelectHandlerProxy();
    }
    _createNewOption(text) {
        const newOption = {
            label: text,
            value: text
        };
        this._dataset.push(newOption);
        this._invalidateFuseCache();
        this._filteredDataset = this._dataset;
        this._selectOption(newOption);
        this._closeDropdown();
    }
    _afterSelection() {
        const input = this.instance?.find(`.${this.topClassBEM}__searchbar__input`);
        const searchText = input?.val()?.toString() || "";
        if (searchText) {
            this._filteredDataset = this._dataset;
            this._refreshDropdownList();
        } else {
            this._updateOptionSelectedStates();
        }
        this._displaySelection();
    }
    _updateOptionSelectedStates() {
        const options = this.instance?.find(`.${this.topClassBEM}__option`);
        if (!options) return;
        options.each((_, el) => {
            const $el = $(el);
            const index = parseInt($el.attr("data-index") ?? "-1", 10);
            const opt = this._filteredDataset[index];
            if (!opt) return;
            if (opt.checked) {
                $el.addClass(`${this.topClassBEM}__option--selected`);
                $el.attr("aria-selected", "true");
            } else {
                $el.removeClass(`${this.topClassBEM}__option--selected`);
                $el.attr("aria-selected", "false");
            }
        });
    }
    _onSelectHandlerProxy() {
        const data = this._dataset.filter(e => e.checked);
        if (this._allowMultiple) this._value.value = data; else this._value.value = data[0] ?? null;
        this._onSelectHandler?.(this._returnFullDataset ? this._dataset : this._value.value);
        this._validate();
    }
    _onResetFilteredDataSearch() {
        this._displaySelection();
        this._filteredDataset = this._dataset;
        this._refreshDropdownList();
    }
    _openDropdown() {
        this.instance?.addClass(`${this.topClassBEM}--topmost`);
        this.instance?.find(`.${this.topClassBEM}__dropdown`).stop(true).slideDown();
        this._isDropdownOpen = true;
        this.instance?.find(`.${this.topClassBEM}__searchbar__input`).attr("aria-expanded", "true");
        this._refreshChevron();
    }
    _closeDropdown() {
        const duration = 300;
        this.instance?.find(`.${this.topClassBEM}__dropdown`).stop(true).slideUp({
            duration: duration
        });
        this.instance?.find(`.${this.topClassBEM}__dropdown`).scrollTop(0);
        this._trackTimeout(() => this.instance?.removeClass(`${this.topClassBEM}--topmost`), duration);
        this._isDropdownOpen = false;
        this.instance?.find(`.${this.topClassBEM}__searchbar__input`).attr("aria-expanded", "false");
        this._refreshChevron();
        this._focusedIndex = -1;
        this.instance?.find(`.${this.topClassBEM}__option--focused`).removeClass(`${this.topClassBEM}__option--focused`);
        this.instance?.find(`.${this.topClassBEM}__create-option--focused`).removeClass(`${this.topClassBEM}__create-option--focused`);
    }
    _bindKeyboardNavigation() {
        this.instance?.off("keydown.combobox-nav");
        this.instance?.on("keydown.combobox-nav", e => {
            const event = e.originalEvent;
            if (!event) return;
            switch (event.key) {
              case "ArrowDown":
                event.preventDefault();
                if (!this._isDropdownOpen) {
                    this._openDropdown();
                }
                this._moveFocus(1);
                break;

              case "ArrowUp":
                event.preventDefault();
                this._moveFocus(-1);
                break;

              case "Enter":
                event.preventDefault();
                this._selectFocusedOption();
                break;

              case "Escape":
                event.preventDefault();
                this._closeDropdown();
                this._onResetFilteredDataSearch();
                break;
            }
        });
    }
    _moveFocus(direction) {
        const options = this._filteredDataset;
        const createRowVisible = this._allowCreate && this.instance?.find(`.${this.topClassBEM}__create-option`)?.css("display") !== "none";
        const maxIndex = createRowVisible ? options.length : options.length - 1;
        if (maxIndex < 0) return;
        let next = this._focusedIndex + direction;
        if (next < 0) next = 0;
        if (next > maxIndex) next = maxIndex;
        if (next < options.length) {
            const maxAttempts = options.length;
            let attempts = 0;
            while (attempts < maxAttempts && next < options.length && options[next]?.disabled) {
                next += direction;
                attempts++;
            }
            if (next < 0) next = 0;
            if (next > maxIndex) next = maxIndex;
            if (next < options.length && options[next]?.disabled) return;
        }
        this.instance?.find(`.${this.topClassBEM}__option--focused`).removeClass(`${this.topClassBEM}__option--focused`);
        this.instance?.find(`.${this.topClassBEM}__create-option--focused`).removeClass(`${this.topClassBEM}__create-option--focused`);
        this._focusedIndex = next;
        if (next === options.length && createRowVisible) {
            const createEl = this.instance?.find(`.${this.topClassBEM}__create-option`);
            createEl?.addClass(`${this.topClassBEM}__create-option--focused`);
            this.instance?.find(`.${this.topClassBEM}__searchbar__input`).removeAttr("aria-activedescendant");
            createEl?.[0]?.scrollIntoView({
                block: "nearest"
            });
        } else {
            const optEl = this.instance?.find(`#${this.id}-opt-${next}`);
            optEl?.addClass(`${this.topClassBEM}__option--focused`);
            this.instance?.find(`.${this.topClassBEM}__searchbar__input`).attr("aria-activedescendant", `${this.id}-opt-${next}`);
            const listEl = this.instance?.find(`.${this.topClassBEM}__dropdown__list`)?.[0];
            const focusedEl = optEl?.[0];
            if (listEl && focusedEl) {
                const listRect = listEl.getBoundingClientRect();
                const optRect = focusedEl.getBoundingClientRect();
                if (optRect.bottom > listRect.bottom || optRect.top < listRect.top) {
                    focusedEl.scrollIntoView({
                        block: "nearest"
                    });
                }
            }
        }
    }
    _selectFocusedOption() {
        if (this._focusedIndex < 0) return;
        if (this._allowCreate && this._focusedIndex === this._filteredDataset.length) {
            const input = this.instance?.find(`.${this.topClassBEM}__searchbar__input`);
            const text = input?.val()?.toString().trim() || "";
            if (text) this._createNewOption(text);
            return;
        }
        if (this._focusedIndex >= this._filteredDataset.length) return;
        const opt = this._filteredDataset[this._focusedIndex];
        if (opt) this._selectOption(opt);
    }
    _bindDropdownMousedownHandler() {
        this.instance?.find(`.${this.topClassBEM}__dropdown`).on("mousedown", e => {
            e.preventDefault();
        });
    }
    _bindOptionClickHandlers() {
        this.instance?.find(`.${this.topClassBEM}__option`).each((_, el) => {
            $(el).on("click", () => {
                if ($(el).attr("data-disabled") !== undefined) return;
                const index = parseInt($(el).attr("data-index") ?? "-1", 10);
                const option = this._filteredDataset[index];
                if (option) this._selectOption(option);
            });
        });
    }
    _bindSearchBarEventHandlers() {
        this.instance?.find(`.${this.topClassBEM}__searchbar`)?.on("click", () => {
            if (!this._isDropdownOpen) this._openDropdown();
        });
        const input = this.instance?.find(`.${this.topClassBEM}__searchbar__input`);
        input?.on("focus", () => input.val(""));
    }
    _onSearchEventListeners() {
        const input = this.instance?.find(`.${this.topClassBEM}__searchbar input`);
        input?.on("keyup", async e => {
            const event = e.originalEvent;
            if (!event) return;
            if (!event.key.match(/^[\w\s]$/) && event.key !== "Backspace" && event.key !== "Delete") return;
            const value = input.val()?.toString() || "";
            this._hasError = false;
            const result = this._filterFn(value);
            if (result && typeof result.then === "function") {
                const seq = ++this._searchSeq;
                this._setLoading(true);
                try {
                    const opts = await result;
                    if (!this.isAlive || seq !== this._searchSeq) return;
                    this._filteredDataset = opts;
                } catch (err) {
                    if (!this.isAlive || seq !== this._searchSeq) return;
                    console.error("[ComboBox] async filter failed", {
                        value: value,
                        err: err
                    });
                    this._filteredDataset = [];
                    this._hasError = true;
                } finally {
                    if (this.isAlive && seq === this._searchSeq) {
                        this._isLoading = false;
                        this._focusedIndex = -1;
                        this._refreshDropdownList();
                    }
                }
            } else {
                this._filteredDataset = result;
                if (result.length === 0) {
                    this._filteredDataset = this._dataset;
                }
                this._focusedIndex = -1;
                this._refreshDropdownList();
            }
        });
    }
    _bindBlurHandler() {
        this.instance?.on("focusout", () => {
            this._trackTimeout(() => {
                const active = document.activeElement;
                if (!this.instance?.[0]?.contains(active)) {
                    this._closeDropdown();
                    this._onResetFilteredDataSearch();
                }
            }, 0);
        });
    }
    _bindClearIconHandler() {
        this.instance?.find(`.${this.topClassBEM}__searchbar__clear`)?.on("click", e => {
            e.stopPropagation();
            this.clearSelection();
        });
    }
    _bindCreateOptionHandler() {
        this.instance?.find(`.${this.topClassBEM}__create-option`).on("click", () => {
            const input = this.instance?.find(`.${this.topClassBEM}__searchbar__input`);
            const text = input?.val()?.toString().trim() || "";
            if (text) this._createNewOption(text);
        });
    }
    _bindClearButtonHandler() {
        this.instance?.find(`.${this.topClassBEM}__clear-btn`).on("click", () => {
            this.clearSelection();
            this._closeDropdown();
        });
    }
    _applyEventListeners() {
        super._applyEventListeners();
        this._bindDropdownMousedownHandler();
        this._bindOptionClickHandlers();
        this._bindSearchBarEventHandlers();
        this._bindBlurHandler();
        this._bindKeyboardNavigation();
        if (this._allowFiltering) this._onSearchEventListeners();
        if (this._allowCreate) this._bindCreateOptionHandler();
        if (this._allowMultiple) {
            this._bindClearButtonHandler();
        } else {
            this._bindClearIconHandler();
            this.instance?.find(`.${this.topClassBEM}__dropdown__list`).on("click", () => this._closeDropdown());
        }
    }
    clearSelection() {
        this._dataset.forEach(e => {
            e.checked = false;
        });
        this._onResetFilteredDataSearch();
        this._onSelectHandlerProxy();
        const input = this.instance?.find(`.${this.topClassBEM}__searchbar__input`);
        input?.val("");
        input?.removeAttr("title");
    }
    get modifierClasses() {
        const mods = [ super.modifierClasses ];
        if (this._allowFiltering) mods.push(`${this.topClassBEM}--filterable`);
        if (this._isDropdownOpen) mods.push(`${this.topClassBEM}--open`);
        return mods.join(" ");
    }
    toString() {
        return `\n      <div\n        id="${this.id}"\n        class="${this.class} ${this.modifierClasses}"\n        tabindex="-1"\n      >\n        ${this._createSearchBar()}\n        ${this._createDropdown()}\n      </div>\n    `;
    }
    get dataset() {
        return this._dataset;
    }
    set dataset(data) {
        this._dataset = this._normalizeDataset(data);
        this._filteredDataset = this._dataset;
        this._invalidateFuseCache();
        this._disableOnEmptyDataset();
        this._syncDatasetFromField();
        const preChecked = this._dataset.filter(e => e.checked);
        if (preChecked.length > 0) {
            this._value.value = this._allowMultiple ? preChecked : preChecked[0];
        } else {
            this._value.value = this._allowMultiple ? [] : null;
        }
        this.render();
    }
    set filteringFunction(callback) {
        this._filterFn = callback;
    }
    render() {
        const initialRender = !this.instance;
        super.render(false);
        this._displaySelection();
        if (initialRender && this._dataset.some(e => e.checked)) {
            this._onSelectHandlerProxy();
        }
    }
    remove() {
        this._clearAllTimeouts();
        super.remove();
    }
}

function normalizeUrl(url) {
    return url.replace(/\/+$/, "").toLowerCase();
}

const _pendingRefreshes = new Map;

const _remoteTokenCache = new Map;

function _extractDigestInfo(res) {
    const payload = res;
    const info = payload?.FormDigestValue ? payload : payload?.GetContextWebInformation ?? payload?.d?.GetContextWebInformation;
    if (!info) return null;
    const token = info.FormDigestValue;
    const timeoutSeconds = info.FormDigestTimeoutSeconds;
    const isInvalidToken = typeof token !== "string" || token.length === 0, isInvalidTimeout = typeof timeoutSeconds !== "number" || !Number.isFinite(timeoutSeconds);
    if (isInvalidToken || isInvalidTimeout) return null;
    return {
        token: token,
        timeoutSeconds: timeoutSeconds
    };
}

function refreshRequestDigest(siteUrl) {
    if (typeof _spPageContextInfo === "undefined" || !_spPageContextInfo.webAbsoluteUrl) {
        return Promise.reject(new SystemError("APIException: RequestDigestRefresh", "_spPageContextInfo is not available. Cannot refresh the request digest outside of a SharePoint context."));
    }
    const localUrl = _spPageContextInfo.webAbsoluteUrl;
    const normalizedLocal = normalizeUrl(localUrl);
    const targetUrl = siteUrl ?? localUrl;
    const normalizedTarget = normalizeUrl(targetUrl);
    const isLocal = normalizedTarget === normalizedLocal;
    if (!isLocal) {
        const cached = _remoteTokenCache.get(normalizedTarget);
        if (cached && Date.now() < cached.expiresAt) {
            return Promise.resolve(cached.token);
        }
    }
    const pending = _pendingRefreshes.get(normalizedTarget);
    if (pending) return pending;
    const promise = new Promise((resolve, reject) => {
        $.ajax({
            url: targetUrl + "/_api/contextinfo",
            type: "POST",
            headers: {
                accept: "application/json;odata=nometadata"
            },
            dataType: "json"
        }).done(res => {
            try {
                const digestInfo = _extractDigestInfo(res);
                if (!digestInfo) {
                    reject(new SystemError("APIException: RequestDigestRefresh", "Unexpected contextinfo response shape -- could not extract digest token"));
                    return;
                }
                const {token: token, timeoutSeconds: timeoutSeconds} = digestInfo;
                if (isLocal) {
                    $("#__REQUESTDIGEST").val(token);
                } else {
                    const REMOTE_BUFFER_S = 120;
                    const safeLivetime = Math.max(timeoutSeconds - REMOTE_BUFFER_S, REMOTE_BUFFER_S);
                    _remoteTokenCache.set(normalizedTarget, {
                        token: token,
                        expiresAt: Date.now() + safeLivetime * 1e3
                    });
                }
                resolve(token);
            } catch (err) {
                reject(new SystemError("APIException: RequestDigestRefresh", `Failed to process contextinfo response -- ${err instanceof Error ? err.message : String(err)}`));
            }
        }).fail(jqXHR => {
            const status = jqXHR.status ?? 0;
            const detail = jqXHR.responseText ?? jqXHR.statusText ?? "Unknown error";
            reject(new SystemError("APIException: RequestDigestRefresh", `HTTP ${status} -- ${detail}`));
        });
    }).finally(() => {
        _pendingRefreshes.delete(normalizedTarget);
    });
    _pendingRefreshes.set(normalizedTarget, promise);
    return promise;
}

let _digestTimerId = null;

let _lastTickTimestamp = Date.now();

function startDigestTimer() {
    stopDigestTimer();
    const DEFAULT_INTERVAL_MS = 25 * 60 * 1e3;
    const BUFFER_S = 120;
    let intervalMs = DEFAULT_INTERVAL_MS;
    if (typeof _spPageContextInfo !== "undefined" && typeof _spPageContextInfo.formDigestTimeoutSeconds === "number" && _spPageContextInfo.formDigestTimeoutSeconds > BUFFER_S) {
        intervalMs = (_spPageContextInfo.formDigestTimeoutSeconds - BUFFER_S) * 1e3;
    }
    _lastTickTimestamp = Date.now();
    _digestTimerId = setInterval(() => {
        const now = Date.now();
        const elapsed = now - _lastTickTimestamp;
        _lastTickTimestamp = now;
        if (elapsed > intervalMs * 2) {
            refreshRequestDigest().catch(err => {
                console.error("[requestDigest.startDigestTimer] digest refresh failed after sleep/suspend detection", err);
                Toast.error("Your session has expired. Please reload the page.", {
                    autoClose: false
                });
                stopDigestTimer();
            });
        }
    }, intervalMs);
}

function stopDigestTimer() {
    if (_digestTimerId !== null) {
        clearInterval(_digestTimerId);
        _digestTimerId = null;
    }
}

const SP_ACCEPT = "application/json;odata=nometadata";

const SP_ACCEPT_MINIMAL = "application/json;odata=minimalmetadata";

const SP_CONTENT_TYPE = "application/json;odata=verbose";

function _ajaxToPromise(payload) {
    return new Promise((resolve, reject) => {
        $.ajax(payload).done(res => resolve(res)).fail(jqXHR => reject(jqXHR));
    });
}

function _isDigestExpiredError(jqXHR) {
    return jqXHR.status === 403 && /security validation/i.test(jqXHR.responseText ?? "");
}

function _isConcurrencyConflict(jqXHR) {
    return jqXHR.status === 412;
}

function _toSystemError(method, jqXHR) {
    if (jqXHR instanceof Error) {
        return new SystemError(`APIException: ${method}`, jqXHR.message);
    }
    const status = jqXHR.status ?? 0;
    const detail = jqXHR.responseText ?? jqXHR.statusText ?? "Unknown error";
    return new SystemError(`APIException: ${method}`, `HTTP ${status} -- ${detail}`);
}

function _getDigestFallback() {
    const v = String($("#__REQUESTDIGEST").val() ?? "");
    if (v.length > 0) return v;
    throw new SystemError("APIException: DigestUnavailable", "The #__REQUESTDIGEST form field is missing or empty. The SharePoint session may have expired.", {
        breaksFlow: true
    });
}

function baseRequest(ajaxPayload) {
    const method = ajaxPayload.type ?? "UNKNOWN";
    if (ajaxPayload.async === false) {
        let response;
        let syncError;
        $.ajax(ajaxPayload).done(res => response = res).fail(jqXHR => syncError = jqXHR);
        if (syncError) {
            if (_isConcurrencyConflict(syncError)) {
                const detail = syncError.responseText ?? syncError.statusText ?? "Unknown error";
                throw new SystemError("ConcurrencyConflict", `HTTP 412 -- This item was already changed on the server. Please refresh your page and try again. (${detail})`, {
                    breaksFlow: false
                });
            }
            throw _toSystemError(method, syncError);
        }
        return response;
    }
    return _ajaxToPromise(ajaxPayload).catch(jqXHR => {
        if (_isConcurrencyConflict(jqXHR)) {
            const detail = jqXHR.responseText ?? jqXHR.statusText ?? "Unknown error";
            throw new SystemError("ConcurrencyConflict", `HTTP 412 -- This item was already changed on the server. Please refresh your page and try again. (${detail})`, {
                breaksFlow: false
            });
        }
        if (_isDigestExpiredError(jqXHR) && ajaxPayload.headers?.["X-RequestDigest"]) {
            const siteUrl = ajaxPayload.url?.split("/_api/")[0];
            return refreshRequestDigest(siteUrl).then(freshToken => {
                const retryPayload = {
                    ...ajaxPayload,
                    headers: {
                        ...ajaxPayload.headers,
                        "X-RequestDigest": freshToken
                    }
                };
                return _ajaxToPromise(retryPayload).catch(retryJqXHR => {
                    throw _toSystemError(method, retryJqXHR);
                });
            });
        }
        throw _toSystemError(method, jqXHR);
    });
}

function spGET(url, options = {}) {
    const {headers: headers, ...requestOptions} = options;
    const requestHeaders = $.extend({
        accept: SP_ACCEPT_MINIMAL
    }, headers ?? {});
    const ajaxPayload = $.extend({
        url: url,
        async: true,
        type: "GET",
        dataType: "json"
    }, requestOptions, {
        headers: requestHeaders
    });
    return baseRequest(ajaxPayload);
}

function spPOST(url, options = {}) {
    const {headers: headers, data: data, ...requestOptions} = options;
    const requestHeaders = $.extend({
        accept: SP_ACCEPT,
        "X-HTTP-Method": "POST",
        "Content-Type": SP_CONTENT_TYPE
    }, headers ?? {});
    requestHeaders["X-RequestDigest"] = options.requestDigest ?? _getDigestFallback();
    const ajaxPayload = $.extend({
        url: url,
        async: true,
        type: "POST",
        data: JSON.stringify(data),
        dataType: "json"
    }, requestOptions, {
        headers: requestHeaders
    });
    return baseRequest(ajaxPayload);
}

function spDELETE(url, options = {}) {
    const {headers: headers, ...requestOptions} = options;
    const requestHeaders = $.extend({
        accept: SP_ACCEPT,
        "X-HTTP-Method": "DELETE",
        "Content-Type": SP_CONTENT_TYPE
    }, headers ?? {});
    requestHeaders["X-RequestDigest"] = options.requestDigest ?? _getDigestFallback();
    const ajaxPayload = $.extend({
        url: url,
        async: true,
        type: "POST"
    }, requestOptions, {
        headers: requestHeaders
    });
    return baseRequest(ajaxPayload);
}

function spMERGE(url, options = {}) {
    const {headers: headers, data: data, ...requestOptions} = options;
    const requestHeaders = $.extend({
        accept: SP_ACCEPT,
        "X-HTTP-Method": "MERGE",
        "Content-Type": SP_CONTENT_TYPE
    }, headers ?? {});
    requestHeaders["X-RequestDigest"] = options.requestDigest ?? _getDigestFallback();
    const ajaxPayload = $.extend({
        url: url,
        async: true,
        type: "POST",
        data: JSON.stringify(data)
    }, requestOptions, {
        headers: requestHeaders
    });
    return baseRequest(ajaxPayload);
}

function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}

function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), 
    value;
}

typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

function isComboBoxOption(value) {
    return typeof value === "object" && value !== null && "label" in value && "value" in value && typeof value.label === "string";
}

function extractComboBoxValue(value) {
    if (Array.isArray(value)) {
        return value.map(item => isComboBoxOption(item) ? item.value : item);
    }
    if (isComboBoxOption(value)) return value.value;
    return value;
}

function toFieldValue(value) {
    if (isComboBoxOption(value)) {
        throw new SystemError("FieldValue", "ComboBoxOptionProps passed directly to toFieldValue(). Use schema.parseForList() or extractComboBoxValue() to extract the .value property before writing to SharePoint.", {
            breaksFlow: true
        });
    }
    if (value === null || value === undefined) {
        throw new SystemError("FieldValue", `Cannot serialize ${value === null ? "null" : "undefined"} to a SharePoint field value`, {
            breaksFlow: true
        });
    }
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
}

function _parseSPString(raw, logTag, logContext = {}) {
    if (raw === "true") return true;
    if (raw === "false") return false;
    if (raw.startsWith("{") || raw.startsWith("[")) {
        try {
            return JSON.parse(raw);
        } catch (err) {
            console.warn(`${logTag} JSON parse failed, returning raw string`, {
                ...logContext,
                raw: raw,
                err: err
            });
            return raw;
        }
    }
    return raw;
}

function fromFieldValue(raw) {
    if (raw == null || raw === "") return null;
    return _parseSPString(raw, "[fromFieldValue]");
}

function parseFieldValues(item) {
    const result = {};
    for (const [key, value] of Object.entries(item)) {
        if (typeof value !== "string") {
            result[key] = value;
            continue;
        }
        result[key] = _parseSPString(value, "[parseFieldValues]", {
            key: key
        });
    }
    return result;
}

var _CurrentUser_instances, _a$3, _CurrentUser_instance, _CurrentUser_initPromise, _CurrentUser_data, _CurrentUser_group, _CurrentUser_initialized, _CurrentUser_runInitialize, _CurrentUser_resolveGroup, _CurrentUser_assertInitialized;

class CurrentUser {
    constructor() {
        _CurrentUser_instances.add(this);
        _CurrentUser_data.set(this, null);
        _CurrentUser_group.set(this, null);
        _CurrentUser_initialized.set(this, false);
        if (__classPrivateFieldGet(_a$3, _a$3, "f", _CurrentUser_instance)) return __classPrivateFieldGet(_a$3, _a$3, "f", _CurrentUser_instance);
        __classPrivateFieldSet(_a$3, _a$3, this, "f", _CurrentUser_instance);
    }
    async initialize(groupHierarchy = [], options) {
        if (__classPrivateFieldGet(this, _CurrentUser_initialized, "f")) return this;
        if (__classPrivateFieldGet(_a$3, _a$3, "f", _CurrentUser_initPromise)) return __classPrivateFieldGet(_a$3, _a$3, "f", _CurrentUser_initPromise);
        __classPrivateFieldSet(_a$3, _a$3, __classPrivateFieldGet(this, _CurrentUser_instances, "m", _CurrentUser_runInitialize).call(this, groupHierarchy, options), "f", _CurrentUser_initPromise);
        return __classPrivateFieldGet(_a$3, _a$3, "f", _CurrentUser_initPromise);
    }
    get(key) {
        __classPrivateFieldGet(this, _CurrentUser_instances, "m", _CurrentUser_assertInitialized).call(this);
        return __classPrivateFieldGet(this, _CurrentUser_data, "f")[key];
    }
    set(key, value) {
        __classPrivateFieldGet(this, _CurrentUser_instances, "m", _CurrentUser_assertInitialized).call(this);
        __classPrivateFieldGet(this, _CurrentUser_data, "f")[key] = value;
    }
    get accessLevel() {
        __classPrivateFieldGet(this, _CurrentUser_instances, "m", _CurrentUser_assertInitialized).call(this);
        return __classPrivateFieldGet(this, _CurrentUser_group, "f")?.entry.groupLabel ?? null;
    }
    get group() {
        __classPrivateFieldGet(this, _CurrentUser_instances, "m", _CurrentUser_assertInitialized).call(this);
        return __classPrivateFieldGet(this, _CurrentUser_group, "f")?.spGroup ?? null;
    }
    get groupId() {
        __classPrivateFieldGet(this, _CurrentUser_instances, "m", _CurrentUser_assertInitialized).call(this);
        return __classPrivateFieldGet(this, _CurrentUser_group, "f")?.spGroup.Id ?? null;
    }
    get groupTitle() {
        __classPrivateFieldGet(this, _CurrentUser_instances, "m", _CurrentUser_assertInitialized).call(this);
        return __classPrivateFieldGet(this, _CurrentUser_group, "f")?.spGroup.Title ?? null;
    }
    get isInitialized() {
        return __classPrivateFieldGet(this, _CurrentUser_initialized, "f");
    }
    toString() {
        __classPrivateFieldGet(this, _CurrentUser_instances, "m", _CurrentUser_assertInitialized).call(this);
        return JSON.stringify({
            ...__classPrivateFieldGet(this, _CurrentUser_data, "f"),
            accessLevel: __classPrivateFieldGet(this, _CurrentUser_group, "f")?.entry.groupLabel ?? null,
            groupId: __classPrivateFieldGet(this, _CurrentUser_group, "f")?.spGroup.Id ?? null,
            groupTitle: __classPrivateFieldGet(this, _CurrentUser_group, "f")?.spGroup.Title ?? null
        });
    }
}

_a$3 = CurrentUser, _CurrentUser_data = new WeakMap, _CurrentUser_group = new WeakMap, 
_CurrentUser_initialized = new WeakMap, _CurrentUser_instances = new WeakSet, _CurrentUser_runInitialize = async function _CurrentUser_runInitialize(groupHierarchy, options) {
    try {
        if (options?.targetUser) {
            console.warn("[CurrentUser] targetUser impersonation active -- DEBUG ONLY", {
                targetUser: options.targetUser
            });
        }
        const siteApi = new SiteApi;
        const loginName = options?.targetUser ?? _spPageContextInfo.userLoginName;
        const data = await getFullUserDetails(loginName, siteApi);
        __classPrivateFieldSet(this, _CurrentUser_data, data, "f");
        __classPrivateFieldSet(this, _CurrentUser_group, groupHierarchy.length ? await __classPrivateFieldGet(this, _CurrentUser_instances, "m", _CurrentUser_resolveGroup).call(this, groupHierarchy, data, siteApi) : null, "f");
        __classPrivateFieldSet(this, _CurrentUser_initialized, true, "f");
        __classPrivateFieldSet(_a$3, _a$3, null, "f", _CurrentUser_initPromise);
        return this;
    } catch (error) {
        __classPrivateFieldSet(_a$3, _a$3, null, "f", _CurrentUser_instance);
        __classPrivateFieldSet(_a$3, _a$3, null, "f", _CurrentUser_initPromise);
        console.error("[CurrentUser.initialize] initialization failed", error);
        if (error instanceof SystemError) throw error;
        const message = error instanceof Error ? error.message : String(error);
        throw new SystemError("CurrentUserInitError", message, {
            cause: error
        });
    }
}, _CurrentUser_resolveGroup = async function _CurrentUser_resolveGroup(hierarchy, data, siteApi) {
    const groupUnion = new Map;
    const _addGroup = g => {
        const key = g.Id ? String(g.Id) : `t:${g.Title.toLowerCase()}`;
        if (!groupUnion.has(key)) groupUnion.set(key, g);
    };
    for (const g of data.groups) _addGroup(g);
    const primaryLogin = data.loginName?.trim().toLowerCase();
    const ghostLogins = data.accountLogins.filter(login => login.trim().toLowerCase() !== primaryLogin);
    const ghostResults = await Promise.all(ghostLogins.map(login => siteApi.getUserGroupsByLogin(login)));
    for (const ghostGroups of ghostResults) {
        for (const g of ghostGroups) _addGroup(g);
    }
    for (let i = hierarchy.length - 1; i >= 0; i--) {
        const entry = hierarchy[i];
        const title = entry.groupTitle.toLowerCase();
        const matched = [ ...groupUnion.values() ].find(g => g.Title.toLowerCase() === title);
        if (matched) {
            return {
                entry: entry,
                spGroup: matched
            };
        }
    }
    return null;
}, _CurrentUser_assertInitialized = function _CurrentUser_assertInitialized() {
    if (!__classPrivateFieldGet(this, _CurrentUser_initialized, "f")) {
        throw new SystemError("CurrentUserNotInitialized", "CurrentUser.initialize() must be awaited before accessing user data.");
    }
};

_CurrentUser_instance = {
    value: null
};

_CurrentUser_initPromise = {
    value: null
};

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = e => String(e ?? "").trim().toLowerCase();

const isValidEmail = e => EMAIL_RX.test(normalizeEmail(e));

const escapeODataStr = s => String(s).replace(/'/g, "''");

function unwrapCollection(data) {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === "object") {
        const obj = data;
        if (Array.isArray(obj.results)) return obj.results;
        if (Array.isArray(obj.value)) return obj.value;
        if ("d" in obj) return unwrapCollection(obj.d);
    }
    return [];
}

var _ListApi_title, _ListApi_listItemType;

const CAML_PAGE_SIZE = 500;

const MAX_NESTING_DEPTH = 2;

const KNOWN_CAML_OPERATORS = new Set([ "Eq", "Neq", "Gt", "Lt", "Geq", "Leq", "Contains", "BeginsWith", "IsNull", "IsNotNull", "Or" ]);

class ListApi {
    constructor(title, options = {}) {
        _ListApi_title.set(this, void 0);
        _ListApi_listItemType.set(this, void 0);
        this._siteApi = options?.siteApi ?? new SiteApi;
        __classPrivateFieldSet(this, _ListApi_title, title, "f");
        __classPrivateFieldSet(this, _ListApi_listItemType, options.listItemType ?? `SP.Data.${title.charAt(0).toUpperCase()}${title.substring(1)}ListItem`, "f");
    }
    _validateAndSerializeFields(method, fields) {
        if (fields == null || typeof fields !== "object" || Array.isArray(fields)) {
            throw new SystemError("ListApi", `${method}: expected a fields object, received ${fields === null ? "null" : Array.isArray(fields) ? "array" : typeof fields}`, {
                breaksFlow: true
            });
        }
        const keys = Object.keys(fields);
        if (keys.length === 0) {
            throw new SystemError("ListApi", `${method}: fields object is empty -- at least one field is required`, {
                breaksFlow: true
            });
        }
        const serialized = {};
        for (const [key, value] of Object.entries(fields)) {
            if (value === undefined || value === null) {
                throw new SystemError("ListApi", `${method}: field '${key}' is ${value === null ? "null" : "undefined"} -- remove the field or provide a valid value`, {
                    breaksFlow: true
                });
            }
            serialized[key] = toFieldValue(value);
        }
        return serialized;
    }
    _validateItemId(id) {
        if (typeof id !== "number" || !Number.isInteger(id) || id < 1) {
            throw new SystemError("ListApi", `Expected a positive integer item ID, received ${JSON.stringify(id)}`, {
                breaksFlow: true
            });
        }
    }
    _validateETag(etag) {
        if (typeof etag !== "string" || etag === "") {
            throw new SystemError("ListApi", `Expected a non-empty ETag string, received ${JSON.stringify(etag)}`, {
                breaksFlow: true
            });
        }
    }
    _validateNonEmptyString(method, paramName, value) {
        if (typeof value !== "string" || value.trim() === "") {
            throw new SystemError("ListApi", `${method}: ${paramName} must be a non-empty string, received ${JSON.stringify(value)}`, {
                breaksFlow: true
            });
        }
    }
    _validateCamlFieldName(fieldName) {
        if (!/^[A-Za-z_][\w.]*$/.test(fieldName)) {
            throw new SystemError("CAMLQuery", `Field name '${fieldName}' is not a valid XML name -- SharePoint internal field names must match [A-Za-z_][\\w.]* (no spaces, quotes, angle brackets, or other special characters)`, {
                breaksFlow: true
            });
        }
    }
    _buildAndClause(clauses) {
        let result = clauses[0];
        for (let i = 1; i < clauses.length; i++) {
            result = `<And>${result}${clauses[i]}</And>`;
        }
        return result;
    }
    _buildOrClause(clauses) {
        let result = clauses[0];
        for (let i = 1; i < clauses.length; i++) {
            result = `<Or>${result}${clauses[i]}</Or>`;
        }
        return result;
    }
    _validateQueryObject(query, depth) {
        if (depth > MAX_NESTING_DEPTH) {
            throw new SystemError("CAMLQuery", `$or nesting depth exceeds maximum of ${MAX_NESTING_DEPTH}`, {
                breaksFlow: true
            });
        }
        if (query === null || query === undefined || typeof query !== "object" || Array.isArray(query)) {
            throw new SystemError("CAMLQuery", `Expected a query object, received ${query === null ? "null" : Array.isArray(query) ? "array" : typeof query}`, {
                breaksFlow: true
            });
        }
        const obj = query;
        const {$or: $or, ...fieldEntries} = obj;
        const fieldKeys = Object.keys(fieldEntries);
        if (fieldKeys.length === 0 && $or === undefined) {
            throw new SystemError("CAMLQuery", "Empty query object -- use getItems() with no arguments to fetch all items", {
                breaksFlow: true
            });
        }
        if ($or !== undefined) {
            if (!Array.isArray($or) || $or.length === 0) {
                throw new SystemError("CAMLQuery", "$or must be a non-empty array of query objects", {
                    breaksFlow: true
                });
            }
            for (const sub of $or) {
                this._validateQueryObject(sub, depth + 1);
            }
        }
        for (const fieldName of fieldKeys) {
            this._validateCondition(fieldName, fieldEntries[fieldName]);
        }
    }
    _validateCondition(fieldName, condition) {
        if (condition === undefined || condition === null) {
            throw new SystemError("CAMLQuery", `Field '${fieldName}' has ${condition === null ? "null" : "undefined"} value -- remove the field or provide a valid condition`, {
                breaksFlow: true
            });
        }
        if (typeof condition === "string") return;
        if (typeof condition !== "object" || Array.isArray(condition)) {
            throw new SystemError("CAMLQuery", `Field '${fieldName}' has invalid condition type: ${Array.isArray(condition) ? "array" : typeof condition}`, {
                breaksFlow: true
            });
        }
        const obj = condition;
        const {operator: operator, value: value} = obj;
        if (operator === "IsNull" || operator === "IsNotNull") return;
        if (operator === "Or") {
            if (!Array.isArray(value) || value.length === 0) {
                throw new SystemError("CAMLQuery", `Field '${fieldName}' with operator 'Or' requires a non-empty array of values`, {
                    breaksFlow: true
                });
            }
            for (let i = 0; i < value.length; i++) {
                if (value[i] === undefined || value[i] === null) {
                    throw new SystemError("CAMLQuery", `Field '${fieldName}' Or values[${i}] is ${value[i] === null ? "null" : "undefined"}`, {
                        breaksFlow: true
                    });
                }
            }
            return;
        }
        if (value === undefined || value === null) {
            throw new SystemError("CAMLQuery", `Field '${fieldName}' with operator '${operator}' has ${value === null ? "null" : "undefined"} value`, {
                breaksFlow: true
            });
        }
    }
    _parseCondition(fieldName, condition) {
        this._validateCamlFieldName(fieldName);
        const safeName = escapeHtml(fieldName);
        if (typeof condition === "string") {
            return `<Eq><FieldRef Name="${safeName}" /><Value Type="Text">${escapeHtml(condition)}</Value></Eq>`;
        }
        const {operator: operator} = condition;
        if (!KNOWN_CAML_OPERATORS.has(operator)) {
            throw new SystemError("CAMLQuery", `Operator '${operator}' is not a recognised CAML operator and would produce malformed XML`, {
                breaksFlow: true
            });
        }
        if (operator === "IsNull" || operator === "IsNotNull") {
            return `<${operator}><FieldRef Name="${safeName}" /></${operator}>`;
        }
        if (operator === "Or") {
            const matchOp = condition.match ?? "Eq";
            if (!KNOWN_CAML_OPERATORS.has(matchOp)) {
                throw new SystemError("CAMLQuery", `Or match operator '${matchOp}' is not a recognised CAML operator and would produce malformed XML`, {
                    breaksFlow: true
                });
            }
            const perValue = condition.value.map(v => `<${matchOp}><FieldRef Name="${safeName}" /><Value Type="Text">${escapeHtml(v)}</Value></${matchOp}>`);
            return perValue.length === 1 ? perValue[0] : this._buildOrClause(perValue);
        }
        return `<${operator}><FieldRef Name="${safeName}" /><Value Type="Text">${escapeHtml(String(condition.value))}</Value></${operator}>`;
    }
    _buildWhereContent(args, depth) {
        if (depth > MAX_NESTING_DEPTH) {
            throw new SystemError("CAMLQuery", `$or nesting depth exceeds maximum of ${MAX_NESTING_DEPTH}`, {
                breaksFlow: true
            });
        }
        const {$or: $or, ...fieldEntries} = args;
        const fieldClauses = [];
        for (const [fieldName, condition] of Object.entries(fieldEntries)) {
            fieldClauses.push(this._parseCondition(fieldName, condition));
        }
        const fieldClause = fieldClauses.length === 0 ? null : fieldClauses.length === 1 ? fieldClauses[0] : this._buildAndClause(fieldClauses);
        let orClause = null;
        if ($or && $or.length > 0) {
            const orParts = $or.map(sub => this._buildWhereContent(sub, depth + 1)).filter(part => part !== null);
            if (orParts.length > 0) {
                orClause = orParts.length === 1 ? orParts[0] : this._buildOrClause(orParts);
            }
        }
        if (fieldClause && orClause) return `<And>${fieldClause}${orClause}</And>`;
        return fieldClause ?? orClause;
    }
    _buildViewXml(whereContent, options = {}, rowLimit) {
        const parts = [ "<View>" ];
        if (options.viewFields && options.viewFields.length > 0) {
            const fieldRefs = options.viewFields.map(f => {
                this._validateCamlFieldName(f);
                return `<FieldRef Name="${escapeHtml(f)}" />`;
            }).join("");
            parts.push(`<ViewFields>${fieldRefs}</ViewFields>`);
        }
        const hasWhere = whereContent !== null;
        const hasOrderBy = options.orderBy && options.orderBy.length > 0;
        const effectiveRowLimit = rowLimit ?? (options.limit != null && options.limit < CAML_PAGE_SIZE ? options.limit : CAML_PAGE_SIZE);
        parts.push("<Query>");
        if (hasWhere) {
            parts.push(`<Where>${whereContent}</Where>`);
        }
        if (hasOrderBy) {
            const orderRefs = options.orderBy.map(o => {
                this._validateCamlFieldName(o.field);
                const asc = o.ascending !== false ? "TRUE" : "FALSE";
                return `<FieldRef Name="${escapeHtml(o.field)}" Ascending="${asc}" />`;
            }).join("");
            parts.push(`<OrderBy>${orderRefs}</OrderBy>`);
        }
        parts.push(`<RowLimit Paged="TRUE">${effectiveRowLimit}</RowLimit>`);
        parts.push("</Query>");
        parts.push("</View>");
        return parts.join("");
    }
    _parseCAMLQueryObject(args, options, rowLimit) {
        const whereContent = this._buildWhereContent(args, 0);
        return this._buildViewXml(whereContent, options, rowLimit);
    }
    _createCAMLQueryPayload(camlQuery, pagingInfo) {
        const query = {
            __metadata: {
                type: "SP.CamlQuery"
            },
            ViewXml: camlQuery
        };
        if (pagingInfo) {
            query.ListItemCollectionPosition = {
                PagingInfo: pagingInfo
            };
        }
        return {
            query: query
        };
    }
    _normalizeCAMLResponse(response) {
        const data = response;
        const verbose = data?.d;
        const rawItems = verbose?.results ?? data?.value ?? [];
        const items = rawItems.map(item => {
            const meta = item.__metadata;
            if (meta?.etag && !item["odata.etag"]) {
                item["odata.etag"] = meta.etag;
            }
            delete item.__metadata;
            return parseFieldValues(item);
        });
        const position = verbose?.ListItemCollectionPosition ?? data?.ListItemCollectionPosition;
        const pagingInfo = position?.PagingInfo ?? null;
        return {
            items: items,
            pagingInfo: pagingInfo
        };
    }
    async _queryRequest(args, options = {}) {
        const limit = options.limit ?? Infinity;
        let camlQuery;
        if (args === undefined) {
            camlQuery = this._buildViewXml(null, options);
        } else if (typeof args === "string") {
            camlQuery = args;
        } else {
            this._validateQueryObject(args, 0);
            camlQuery = this._parseCAMLQueryObject(args, options);
        }
        const digest = await this._siteApi.getRequestDigest();
        const url = `${this.endpoint}/getitems`;
        const allItems = [];
        let pagingInfo = null;
        do {
            const payload = this._createCAMLQueryPayload(camlQuery, pagingInfo);
            const response = await spPOST(url, {
                requestDigest: digest,
                data: payload,
                headers: {
                    accept: "application/json;odata=verbose"
                }
            });
            const {items: page, pagingInfo: nextPagingInfo} = this._normalizeCAMLResponse(response);
            allItems.push(...page);
            pagingInfo = nextPagingInfo;
        } while (pagingInfo && allItems.length < limit);
        return allItems.slice(0, limit);
    }
    async getItems(query, options = {}) {
        return this._queryRequest(query, options);
    }
    async getItemsPaged(query, options = {}) {
        const {pageSize: pageSize = CAML_PAGE_SIZE, ...queryOptions} = options;
        if (typeof pageSize !== "number" || !Number.isInteger(pageSize) || pageSize < 1) {
            throw new SystemError("ListApi", `getItemsPaged: pageSize must be a positive integer, received ${JSON.stringify(pageSize)}`, {
                breaksFlow: true
            });
        }
        const limit = queryOptions.limit ?? Infinity;
        let fetched = 0;
        const buildCamlQuery = rowLimit => {
            if (query === undefined) {
                return this._buildViewXml(null, queryOptions, rowLimit);
            }
            if (typeof query === "string") {
                return query;
            }
            this._validateQueryObject(query, 0);
            return this._parseCAMLQueryObject(query, queryOptions, rowLimit);
        };
        const url = `${this.endpoint}/getitems`;
        const fetchPage = async pagingInfo => {
            const remaining = limit - fetched;
            const effectivePageSize = Math.min(pageSize, remaining);
            const camlQuery = buildCamlQuery(effectivePageSize);
            const digest = await this._siteApi.getRequestDigest();
            const payload = this._createCAMLQueryPayload(camlQuery, pagingInfo);
            const response = await spPOST(url, {
                requestDigest: digest,
                data: payload,
                headers: {
                    accept: "application/json;odata=verbose"
                }
            });
            const {items: items, pagingInfo: nextPagingInfo} = this._normalizeCAMLResponse(response);
            fetched += items.length;
            const hasMore = nextPagingInfo !== null && fetched < limit;
            return {
                items: items,
                next: hasMore ? () => fetchPage(nextPagingInfo) : null
            };
        };
        return fetchPage(null);
    }
    async getItemByTitle(title) {
        return this._queryRequest({
            Title: title
        });
    }
    async getItemByUUID(uuid) {
        return this._queryRequest({
            UUID: uuid
        });
    }
    async getOwnedItems(userId) {
        let resolvedId;
        if (userId !== undefined) {
            resolvedId = userId;
        } else {
            const user = new CurrentUser;
            if (!user.isInitialized) {
                throw new SystemError("ListApi", "getOwnedItems() requires CurrentUser to be initialized. Call `await new CurrentUser().initialize(...)` before using getOwnedItems() without an explicit userId.", {
                    breaksFlow: true
                });
            }
            resolvedId = String(user.get("siteUserId"));
        }
        return this._queryRequest({
            AuthorId: resolvedId
        });
    }
    async createItem(item) {
        const serialized = this._validateAndSerializeFields("createItem", item);
        const itemWithMetadata = $.extend({
            __metadata: {
                type: __classPrivateFieldGet(this, _ListApi_listItemType, "f")
            }
        }, serialized);
        const digest = await this._siteApi.getRequestDigest();
        const endpoint = `${this.endpoint}/items`;
        return spPOST(endpoint, {
            data: itemWithMetadata,
            requestDigest: digest
        });
    }
    async deleteItem(id, etag) {
        this._validateItemId(id);
        this._validateETag(etag);
        const digest = await this._siteApi.getRequestDigest();
        const endpoint = `${this.endpoint}/items(${id})`;
        return spDELETE(endpoint, {
            requestDigest: digest,
            headers: {
                "IF-MATCH": etag
            }
        });
    }
    async _deleteALLItems() {
        const items = await this.getItems(undefined, {
            limit: Infinity
        });
        console.warn(`[ListApi._deleteALLItems] starting -- ${items.length} item(s) to delete from '${__classPrivateFieldGet(this, _ListApi_title, "f")}'`);
        let deleted = 0;
        for (const item of items) {
            try {
                await this.deleteItem(item.Id, item["odata.etag"]);
                deleted++;
            } catch (err) {
                console.error(`[ListApi._deleteALLItems] failed on item ${item.Id} (${deleted}/${items.length} deleted so far)`, err);
                throw err;
            }
        }
        console.warn(`[ListApi._deleteALLItems] done -- ${deleted}/${items.length} item(s) deleted from '${__classPrivateFieldGet(this, _ListApi_title, "f")}'`);
    }
    async updateItem(id, fields, etag) {
        this._validateItemId(id);
        this._validateETag(etag);
        const serialized = this._validateAndSerializeFields("updateItem", fields);
        const digest = await this._siteApi.getRequestDigest();
        const data = {
            __metadata: {
                type: __classPrivateFieldGet(this, _ListApi_listItemType, "f")
            },
            ...serialized
        };
        return spMERGE(`${this.endpoint}/items(${id})`, {
            data: data,
            requestDigest: digest,
            headers: {
                "IF-MATCH": etag
            }
        });
    }
    async getFields() {
        const url = `${this.endpoint}/fields?$filter=Hidden eq false and ReadOnlyField eq false`;
        const response = await spGET(url);
        return response?.value ?? [];
    }
    async createField(options) {
        this._validateNonEmptyString("createField", "title", options.title);
        const digest = await this._siteApi.getRequestDigest();
        const isNote = options.multiline === true;
        const body = {
            __metadata: {
                type: isNote ? "SP.FieldMultiLineText" : "SP.FieldText"
            },
            Title: options.title,
            FieldTypeKind: isNote ? 3 : 2,
            ...isNote && {
                RichText: false
            }
        };
        if (options.indexed !== undefined) body.Indexed = options.indexed;
        return spPOST(`${this.endpoint}/fields`, {
            requestDigest: digest,
            data: body
        });
    }
    async deleteField(internalName) {
        this._validateNonEmptyString("deleteField", "internalName", internalName);
        const digest = await this._siteApi.getRequestDigest();
        await spDELETE(`${this.endpoint}/fields/getbyinternalnameortitle('${escapeODataStr(internalName)}')`, {
            requestDigest: digest,
            headers: {
                "IF-MATCH": "*"
            }
        });
    }
    async setFieldIndexed(internalName, indexed) {
        this._validateNonEmptyString("setFieldIndexed", "internalName", internalName);
        const digest = await this._siteApi.getRequestDigest();
        await spMERGE(`${this.endpoint}/fields/getbyinternalnameortitle('${escapeODataStr(internalName)}')`, {
            data: {
                __metadata: {
                    type: "SP.Field"
                },
                Indexed: indexed
            },
            requestDigest: digest,
            headers: {
                "IF-MATCH": "*"
            }
        });
    }
    get endpoint() {
        return `${this._siteApi.url}/_api/web/lists/getbytitle('${escapeODataStr(__classPrivateFieldGet(this, _ListApi_title, "f"))}')`;
    }
    get listItemType() {
        return __classPrivateFieldGet(this, _ListApi_listItemType, "f");
    }
}

_ListApi_title = new WeakMap, _ListApi_listItemType = new WeakMap;

function sanitizeQuery(fields) {
    const {$or: $or, ...rest} = fields;
    const result = {};
    for (const [key, value] of Object.entries(rest)) {
        if (value == null) continue;
        if (typeof value === "object" && "operator" in value && value.operator === "Or") {
            const clean = value.value.filter(v => v != null);
            if (clean.length === 0) continue;
            result[key] = {
                ...value,
                value: clean
            };
        } else {
            result[key] = value;
        }
    }
    if ($or && $or.length > 0) {
        const cleanedOr = $or.map(sub => sanitizeQuery(sub)).filter(sub => sub !== undefined);
        if (cleanedOr.length > 0) {
            result.$or = cleanedOr;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}

var _SiteApi_instances, _a$2, _SiteApi_instances_1, _SiteApi_url, _SiteApi_lists, _SiteApi_groupSelector;

class SiteApi {
    constructor(absoluteUrl) {
        _SiteApi_instances.add(this);
        _SiteApi_url.set(this, void 0);
        _SiteApi_lists.set(this, void 0);
        const url = absoluteUrl ?? _spPageContextInfo.webAbsoluteUrl;
        const key = normalizeUrl(url);
        const existing = __classPrivateFieldGet(_a$2, _a$2, "f", _SiteApi_instances_1).get(key);
        if (existing) return existing;
        __classPrivateFieldSet(this, _SiteApi_url, url, "f");
        __classPrivateFieldSet(this, _SiteApi_lists, new Map, "f");
        __classPrivateFieldGet(_a$2, _a$2, "f", _SiteApi_instances_1).set(key, this);
    }
    list(title, options) {
        const key = title.toLowerCase();
        let instance = __classPrivateFieldGet(this, _SiteApi_lists, "f").get(key);
        if (!instance) {
            instance = new ListApi(title, {
                ...options,
                siteApi: this
            });
            __classPrivateFieldGet(this, _SiteApi_lists, "f").set(key, instance);
        }
        return instance;
    }
    getFullUserDetails(loginName) {
        return getFullUserDetails(loginName, this);
    }
    async getRequestDigest() {
        const localNormalized = normalizeUrl(_spPageContextInfo.webAbsoluteUrl);
        const thisNormalized = normalizeUrl(__classPrivateFieldGet(this, _SiteApi_url, "f"));
        if (thisNormalized === localNormalized) {
            const domValue = $("#__REQUESTDIGEST").val();
            if (typeof domValue === "string" && domValue.length > 0) {
                return domValue;
            }
            return refreshRequestDigest(__classPrivateFieldGet(this, _SiteApi_url, "f"));
        }
        return refreshRequestDigest(__classPrivateFieldGet(this, _SiteApi_url, "f"));
    }
    async getLists() {
        const response = await spGET(`${__classPrivateFieldGet(this, _SiteApi_url, "f")}/_api/web/lists`);
        return response.value ?? [];
    }
    async getSiteGroups() {
        const response = await spGET(`${__classPrivateFieldGet(this, _SiteApi_url, "f")}/_api/web/sitegroups`);
        return response.value ?? [];
    }
    async getGroupUsers(group, options) {
        const selector = __classPrivateFieldGet(this, _SiteApi_instances, "m", _SiteApi_groupSelector).call(this, group);
        const response = await spGET(`${__classPrivateFieldGet(this, _SiteApi_url, "f")}/_api/web/sitegroups/${selector}/users`);
        const seen = new Map;
        for (const user of response.value ?? []) {
            if (!isValidEmail(user.Email)) continue;
            const key = normalizeEmail(user.Email);
            const existing = seen.get(key);
            if (!existing || !existing.Title && user.Title) {
                seen.set(key, user);
            }
        }
        const users = Array.from(seen.values());
        if (!options?.enrich) return users;
        return Promise.all(users.map(async user => {
            const profile = await getUserProfile(user.LoginName);
            return {
                ...user,
                ...profile
            };
        }));
    }
    async getGroupUsersByEmail(group, email) {
        const normalized = normalizeEmail(email);
        if (!normalized || !isValidEmail(normalized)) {
            console.warn("[SiteApi.getGroupUsersByEmail] empty/invalid email -- skipping request", {
                email: email
            });
            return [];
        }
        const selector = __classPrivateFieldGet(this, _SiteApi_instances, "m", _SiteApi_groupSelector).call(this, group);
        const filter = `Email eq '${escapeODataStr(normalized)}'`;
        const url = `${__classPrivateFieldGet(this, _SiteApi_url, "f")}/_api/web/sitegroups/${selector}/users` + `?$filter=${encodeURIComponent(filter)}` + `&$select=Id,LoginName,Title,Email`;
        const response = await spGET(url);
        return response.value ?? [];
    }
    async isUserInGroup(group, email) {
        return (await this.getGroupUsersByEmail(group, email)).length > 0;
    }
    async getUserGroupsByLogin(login) {
        const trimmed = login?.trim();
        if (!trimmed) {
            console.warn("[SiteApi.getUserGroupsByLogin] empty login -- skipping request");
            return [];
        }
        try {
            const filter = `LoginName eq '${escapeODataStr(trimmed)}'`;
            const lookupUrl = `${__classPrivateFieldGet(this, _SiteApi_url, "f")}/_api/web/siteusers` + `?$filter=${encodeURIComponent(filter)}` + `&$select=Id`;
            const lookupResponse = await spGET(lookupUrl);
            const users = lookupResponse.value ?? [];
            if (users.length === 0) {
                console.warn("[SiteApi.getUserGroupsByLogin] login not found in UIL -- no groups resolved", {
                    login: trimmed
                });
                return [];
            }
            const userId = users[0].Id;
            const groupsUrl = `${__classPrivateFieldGet(this, _SiteApi_url, "f")}/_api/web/getuserbyid(${userId})/groups`;
            const groupsResponse = await spGET(groupsUrl);
            return groupsResponse.value ?? [];
        } catch (err) {
            console.warn("[SiteApi.getUserGroupsByLogin] failed to resolve groups for login", {
                login: trimmed,
                err: err
            });
            return [];
        }
    }
    getWebInfo() {
        return spGET(`${__classPrivateFieldGet(this, _SiteApi_url, "f")}/_api/web`);
    }
    _validateTitle(method, title) {
        if (typeof title !== "string" || title.trim() === "") {
            throw new SystemError("SiteApi", `${method}: title must be a non-empty string, received ${JSON.stringify(title)}`, {
                breaksFlow: true
            });
        }
    }
    async createList(title, options = {}) {
        this._validateTitle("createList", title);
        const {description: description = "", template: template = 100} = options;
        const digest = await this.getRequestDigest();
        await spPOST(`${__classPrivateFieldGet(this, _SiteApi_url, "f")}/_api/web/lists`, {
            requestDigest: digest,
            data: {
                __metadata: {
                    type: "SP.List"
                },
                Title: title,
                Description: description,
                BaseTemplate: template,
                AllowContentTypes: true
            }
        });
        return this.list(title);
    }
    async deleteList(title) {
        this._validateTitle("deleteList", title);
        const digest = await this.getRequestDigest();
        await spDELETE(`${__classPrivateFieldGet(this, _SiteApi_url, "f")}/_api/web/lists/getbytitle('${escapeODataStr(title)}')`, {
            requestDigest: digest,
            headers: {
                "IF-MATCH": "*"
            }
        });
        __classPrivateFieldGet(this, _SiteApi_lists, "f").delete(title.toLowerCase());
    }
    get url() {
        return __classPrivateFieldGet(this, _SiteApi_url, "f");
    }
}

_a$2 = SiteApi, _SiteApi_url = new WeakMap, _SiteApi_lists = new WeakMap, _SiteApi_instances = new WeakSet, 
_SiteApi_groupSelector = function _SiteApi_groupSelector(group) {
    return typeof group === "number" ? `getbyid(${group})` : `getbyname('${escapeODataStr(String(group))}')`;
};

_SiteApi_instances_1 = {
    value: new Map
};

function _buildSearchPayload(query, options) {
    return {
        queryParams: {
            __metadata: {
                type: "SP.UI.ApplicationPages.ClientPeoplePickerQueryParameters"
            },
            QueryString: query,
            MaximumEntitySuggestions: options.maximumSuggestions ?? 10,
            PrincipalType: options.principalType ?? 1,
            PrincipalSource: options.principalSource ?? 15,
            AllowEmailAddresses: true,
            AllowMultipleEntities: true,
            SharePointGroupID: 0
        }
    };
}

function _unwrapD(data) {
    if (data !== null && typeof data === "object") {
        const obj = data;
        if ("d" in obj) return obj.d;
        if ("value" in obj && !Array.isArray(obj.value)) return obj.value;
    }
    return data;
}

function _scoreResult(r) {
    let score = 0;
    if (r.DisplayText) score++;
    if (r.EntityData?.Email) score++;
    if (r.EntityData?.Title) score++;
    if (r.EntityData?.Department) score++;
    if (r.EntityData?.MobilePhone) score++;
    if (r.EntityData?.SIPAddress) score++;
    if (r.EntityData?.PrincipalType) score++;
    return score;
}

function _normalizeResults(results) {
    const flat = [];
    for (const r of results) {
        flat.push(r);
        if (Array.isArray(r.MultipleMatches) && r.MultipleMatches.length) {
            flat.push(...r.MultipleMatches);
        }
    }
    const resolved = flat.filter(r => r.IsResolved === true);
    const map = new Map;
    for (const r of resolved) {
        const rawKey = r.EntityData?.Email || parseEmployeeId(r.Key);
        const key = rawKey.toLowerCase();
        if (!key) {
            console.warn("[searchUsers] dropping result with no email or login key", r);
            continue;
        }
        const existing = map.get(key);
        if (!existing || _scoreResult(r) > _scoreResult(existing)) {
            map.set(key, r);
        }
    }
    return [ ...map.values() ];
}

async function _resolveLoginName(login) {
    if (login.startsWith("i:")) return login;
    const allResults = await searchUsers(login, {
        maximumSuggestions: 10,
        raw: true
    });
    const resolved = allResults.filter(r => r.IsResolved);
    if (resolved.length === 0) return login;
    if (resolved.length === 1) return resolved[0].Key;
    const currentLogin = _spPageContextInfo?.userLoginName ?? "";
    const prefixMatch = currentLogin.match(/^(i:[^|]+\|)/);
    if (prefixMatch) {
        const currentPrefix = prefixMatch[1];
        const sameProvider = resolved.find(r => r.Key.startsWith(currentPrefix) && r.IsResolved);
        if (sameProvider) return sameProvider.Key;
    }
    return resolved[0].Key;
}

async function _fetchProfile(loginName, siteUrl) {
    const encodedLogin = encodeURIComponent(`'${loginName}'`);
    const endpoint = `${siteUrl}/_api/SP.UserProfiles.PeopleManager` + `/GetPropertiesFor(accountName=@v)?@v=${encodedLogin}`;
    const data = await spGET(endpoint);
    return _unwrapD(data);
}

async function _ensureUser(loginName, siteApi) {
    const digest = await siteApi.getRequestDigest();
    const endpoint = `${siteApi.url}/_api/web/ensureuser`;
    const data = await spPOST(endpoint, {
        requestDigest: digest,
        data: {
            logonName: loginName
        }
    });
    return _unwrapD(data);
}

async function _fetchUserGroups(userId, siteUrl) {
    const endpoint = `${siteUrl}/_api/web/getuserbyid(${userId})/groups`;
    const data = await spGET(endpoint);
    return unwrapCollection(_unwrapD(data));
}

async function _resolvePickerIdentity(normalizedLogin) {
    try {
        const samAccountName = parseEmployeeId(normalizedLogin);
        const allResults = await searchUsers(samAccountName, {
            maximumSuggestions: 20,
            raw: true
        });
        const resolved = allResults.filter(r => r.IsResolved === true);
        if (resolved.length === 0) return null;
        let hit;
        if (resolved.length === 1) {
            hit = resolved[0];
        } else {
            hit = resolved.find(r => r.Key === normalizedLogin);
            if (!hit) {
                const prefixMatch = normalizedLogin.match(/^(i:[^|]+\|)/);
                if (prefixMatch) {
                    const prefix = prefixMatch[1];
                    hit = resolved.find(r => r.Key.startsWith(prefix));
                }
            }
            if (!hit) hit = resolved[0];
        }
        const seenLogins = new Set;
        const seenEmails = new Set;
        const allLogins = [];
        const allEmails = [];
        for (const r of resolved) {
            const login = r.Key?.trim();
            if (login) {
                const key = login.toLowerCase();
                if (!seenLogins.has(key)) {
                    seenLogins.add(key);
                    allLogins.push(login);
                }
            }
            const email = r.EntityData?.Email?.trim();
            if (email) {
                const key = email.toLowerCase();
                if (!seenEmails.has(key)) {
                    seenEmails.add(key);
                    allEmails.push(email);
                }
            }
        }
        return {
            email: hit.EntityData?.Email || null,
            displayName: hit.DisplayText || null,
            allLogins: allLogins,
            allEmails: allEmails
        };
    } catch (err) {
        console.warn("[getFullUserDetails] picker identity resolution failed, falling back to profile/UIL values", {
            normalizedLogin: normalizedLogin,
            err: err
        });
        return null;
    }
}

function parseEmployeeId(loginName) {
    const afterPipe = loginName.includes("|") ? loginName.split("|").pop() : loginName;
    return afterPipe.includes("\\") ? afterPipe.split("\\").pop() : afterPipe;
}

async function searchUsers(query, options = {}) {
    const payload = _buildSearchPayload(query, options);
    const endpoint = `${_spPageContextInfo.webAbsoluteUrl}/_api/SP.UI.ApplicationPages` + `.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser`;
    const digest = await (new SiteApi).getRequestDigest();
    const data = await spPOST(endpoint, {
        data: payload,
        requestDigest: digest
    });
    const unwrapped = _unwrapD(data);
    const rawJson = typeof unwrapped === "string" ? unwrapped : unwrapped.ClientPeoplePickerSearchUser;
    let parsed;
    try {
        parsed = JSON.parse(rawJson);
    } catch (err) {
        console.error("[searchUsers] JSON.parse failed -- response may be an HTML error page (session expiry?)", {
            rawJson: rawJson,
            err: err
        });
        throw new SystemError("PeoplePickerParseError", "searchUsers: failed to parse ClientPeoplePickerSearchUser response as JSON", {
            breaksFlow: false,
            cause: err
        });
    }
    return options.raw ? parsed : _normalizeResults(parsed);
}

async function getUserProfile(loginName) {
    const normalizedLogin = await _resolveLoginName(loginName);
    const profile = await _fetchProfile(normalizedLogin, _spPageContextInfo.webAbsoluteUrl);
    return {
        employeeId: parseEmployeeId(normalizedLogin),
        loginName: normalizedLogin,
        displayName: profile.DisplayName ?? "",
        email: profile.Email ?? "",
        jobTitle: profile.Title ?? "",
        pictureUrl: profile.PictureUrl ?? "",
        personalUrl: profile.PersonalUrl ?? "",
        directReports: unwrapCollection(profile.DirectReports),
        managers: unwrapCollection(profile.ExtendedManagers),
        peers: unwrapCollection(profile.Peers),
        profileProperties: Object.fromEntries(unwrapCollection(profile.UserProfileProperties).filter(p => p.Value).map(p => [ p.Key, p.Value ]))
    };
}

async function getFullUserDetails(loginName, siteApi = new SiteApi) {
    const normalizedLogin = await _resolveLoginName(loginName);
    const [spUser, profileResult, picker] = await Promise.all([ _ensureUser(normalizedLogin, siteApi), _fetchProfile(normalizedLogin, siteApi.url).catch(err => {
        console.warn("[getFullUserDetails] failed to fetch profile, continuing without it", {
            loginName: normalizedLogin,
            err: err
        });
        return null;
    }), _resolvePickerIdentity(normalizedLogin) ]);
    const profile = profileResult;
    let groups = [];
    try {
        groups = await _fetchUserGroups(spUser.Id, siteApi.url);
    } catch (err) {
        console.warn("[getFullUserDetails] failed to fetch groups, continuing without them", {
            userId: spUser.Id,
            err: err
        });
    }
    const seenLogins = new Set;
    const seenEmails = new Set;
    const accountLogins = [];
    const accountEmails = [];
    const _addLogin = v => {
        const s = v?.trim();
        if (!s) return;
        const k = s.toLowerCase();
        if (!seenLogins.has(k)) {
            seenLogins.add(k);
            accountLogins.push(s);
        }
    };
    const _addEmail = v => {
        const s = v?.trim();
        if (!s) return;
        const k = s.toLowerCase();
        if (!seenEmails.has(k)) {
            seenEmails.add(k);
            accountEmails.push(s);
        }
    };
    if (picker) {
        for (const login of picker.allLogins) _addLogin(login);
        for (const email of picker.allEmails) _addEmail(email);
    }
    _addLogin(spUser.LoginName);
    _addEmail(spUser.Email);
    _addEmail(profile?.Email);
    return {
        employeeId: parseEmployeeId(spUser.LoginName),
        loginName: spUser.LoginName,
        displayName: picker?.displayName || profile?.DisplayName || spUser.Title,
        email: picker?.email || profile?.Email || spUser.Email,
        siteUserId: spUser.Id,
        jobTitle: profile?.Title ?? "",
        pictureUrl: profile?.PictureUrl ?? "",
        personalUrl: profile?.PersonalUrl ?? "",
        directReports: unwrapCollection(profile?.DirectReports),
        managers: unwrapCollection(profile?.ExtendedManagers),
        peers: unwrapCollection(profile?.Peers),
        groups: groups,
        profileProperties: Object.fromEntries(unwrapCollection(profile?.UserProfileProperties).filter(p => p.Value).map(p => [ p.Key, p.Value ])),
        accountLogins: accountLogins,
        accountEmails: accountEmails
    };
}

var _UserIdentity_details, _UserIdentity_properties;

class UserIdentity {
    constructor(email, displayName, properties) {
        _UserIdentity_details.set(this, null);
        _UserIdentity_properties.set(this, void 0);
        if (!email?.trim()) {
            throw new SystemError("InvalidUserIdentity", `UserIdentity requires non-empty email. Received: email="${email}"`, {
                breaksFlow: false
            });
        }
        this.email = email;
        this.displayName = displayName;
        if (properties) {
            const filtered = {};
            for (const [key, val] of Object.entries(properties)) {
                if (key === "email" || key === "displayName") continue;
                if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
                    filtered[key] = val;
                }
            }
            __classPrivateFieldSet(this, _UserIdentity_properties, Object.freeze(filtered), "f");
        } else {
            __classPrivateFieldSet(this, _UserIdentity_properties, Object.freeze({}), "f");
        }
    }
    get details() {
        return __classPrivateFieldGet(this, _UserIdentity_details, "f");
    }
    prop(key) {
        return __classPrivateFieldGet(this, _UserIdentity_properties, "f")[key];
    }
    hasProp(key) {
        return key in __classPrivateFieldGet(this, _UserIdentity_properties, "f");
    }
    get properties() {
        return __classPrivateFieldGet(this, _UserIdentity_properties, "f");
    }
    with(properties) {
        const merged = {
            ...__classPrivateFieldGet(this, _UserIdentity_properties, "f"),
            ...properties
        };
        const identity = new UserIdentity(this.email, this.displayName, merged);
        if (__classPrivateFieldGet(this, _UserIdentity_details, "f")) {
            __classPrivateFieldSet(identity, _UserIdentity_details, __classPrivateFieldGet(this, _UserIdentity_details, "f"), "f");
        }
        return identity;
    }
    toJSON() {
        return {
            ...__classPrivateFieldGet(this, _UserIdentity_properties, "f"),
            email: this.email,
            displayName: this.displayName
        };
    }
    static fromField(value) {
        if (value == null) return null;
        if (typeof value === "object" && !Array.isArray(value)) {
            const {email: rawEmail, displayName: rawName, ...rest} = value;
            try {
                const properties = {};
                for (const [key, val] of Object.entries(rest)) {
                    if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
                        properties[key] = val;
                    }
                }
                return new UserIdentity(String(rawEmail ?? ""), String(rawName ?? ""), properties);
            } catch (err) {
                console.warn("[UserIdentity.fromField] failed to construct UserIdentity from field value, returning null", {
                    raw: value,
                    err: err
                });
                return null;
            }
        }
        return null;
    }
    static manyFromField(value) {
        if (value == null) return [];
        if (Array.isArray(value)) {
            return value.map(entry => UserIdentity.fromField(entry)).filter(identity => identity !== null);
        }
        return [];
    }
    static fromSearchResult(result) {
        const email = result.EntityData?.Email?.trim();
        if (!email) {
            console.warn("[UserIdentity.fromSearchResult] search result has no email -- skipping", {
                displayText: result.DisplayText
            });
            return null;
        }
        return new UserIdentity(email, result.DisplayText);
    }
    static fromCurrentUser(user) {
        return new UserIdentity(user.get("email"), user.get("displayName"));
    }
    async fetchFullDetails() {
        try {
            __classPrivateFieldSet(this, _UserIdentity_details, await getFullUserDetails(this.email), "f");
        } catch (err) {
            console.error("[UserIdentity.fetchFullDetails] failed to fetch full user details", {
                email: this.email,
                err: err
            });
            throw err;
        }
    }
    toString() {
        return this.displayName;
    }
}

_UserIdentity_details = new WeakMap, _UserIdentity_properties = new WeakMap;

class PeoplePicker extends ComboBox {
    constructor(field, props) {
        const {debounceMs: debounceMs, minimumCharacters: minimumCharacters, maximumSuggestions: maximumSuggestions, principalType: principalType, principalSource: principalSource, ...comboBoxProps} = props;
        super(field, [], {
            ...comboBoxProps,
            allowFiltering: true
        });
        this._lastSearchResults = [];
        this._isMultiple = comboBoxProps.allowMultiple ?? false;
        this._isDisabled = comboBoxProps.isDisabled ?? false;
        this._minimumCharacters = minimumCharacters ?? 2;
        this._searchOptions = {
            maximumSuggestions: maximumSuggestions,
            principalType: principalType,
            principalSource: principalSource
        };
        this._debouncedSearch = debounce(query => this._executeSearch(query), debounceMs ?? 300);
    }
    async _executeSearch(query) {
        const seq = ++this._searchSeq;
        this._setLoading(true);
        try {
            const results = await searchUsers(query, this._searchOptions);
            if (!this.isAlive || seq !== this._searchSeq) return;
            this._lastSearchResults = results;
            const options = results.reduce((acc, r) => {
                if (!r.EntityData?.Email || !r.DisplayText) {
                    console.warn("PeoplePicker: skipping result without email or display name", r.DisplayText, r.EntityData?.Email);
                    return acc;
                }
                acc.push({
                    label: r.DisplayText,
                    value: UserIdentity.fromSearchResult(r),
                    disabled: !r.IsResolved
                });
                return acc;
            }, []);
            if (this._isMultiple) {
                const newEmails = new Set(options.map(o => o.value.email));
                const preserved = this._dataset.filter(o => o.checked && !newEmails.has(o.value.email));
                this._dataset = [ ...preserved, ...options ];
            } else {
                this._dataset = options;
            }
            this._filteredDataset = this._dataset;
        } catch (err) {
            if (!this.isAlive || seq !== this._searchSeq) return;
            console.error("[PeoplePicker] user search failed", {
                query: query,
                err: err
            });
            this._hasError = true;
        } finally {
            if (this.isAlive && seq === this._searchSeq) {
                this._isLoading = false;
                this._refreshDropdownList();
            }
        }
    }
    _onSearchEventListeners() {
        const input = this.instance?.find(`.${this.topClassBEM}__searchbar input`);
        input?.on("keyup", e => {
            const event = e.originalEvent;
            if (!event?.key.match(/^[\w\s]$/) && event?.key !== "Backspace" && event?.key !== "Delete") return;
            const value = input.val()?.toString() || "";
            if (value.length >= this._minimumCharacters) {
                this._setLoading(true);
                this._debouncedSearch(value);
            } else {
                this._debouncedSearch.cancel();
                if (this._isMultiple) {
                    const preserved = this._dataset.filter(o => o.checked);
                    this._dataset = preserved;
                    this._filteredDataset = preserved;
                } else {
                    this._dataset = [];
                    this._filteredDataset = [];
                }
                this._isLoading = false;
                this._refreshDropdownList();
            }
        });
    }
    _emptyMessage() {
        const input = this.instance?.find(`.${this.topClassBEM}__searchbar__input`);
        const len = input?.val()?.toString().length ?? 0;
        if (len === 0) return escapeHtml("Type to search people");
        if (len < this._minimumCharacters) return escapeHtml(`Type at least ${this._minimumCharacters} characters`);
        return super._emptyMessage();
    }
    remove() {
        this._debouncedSearch.cancel();
        super.remove();
    }
    async resolveUser(identifier) {
        if (!identifier) return null;
        this._setLoading(true);
        try {
            const results = await searchUsers(identifier, this._searchOptions);
            if (!this.isAlive || results.length === 0) return null;
            const id = identifier.toLowerCase();
            const match = results.find(r => r.IsResolved && (r.Key.toLowerCase() === id || r.DisplayText.toLowerCase() === id || r.EntityData?.Email?.toLowerCase() === id || parseEmployeeId(r.Key).toLowerCase() === id));
            if (!match) return null;
            if (!match.EntityData?.Email || !match.DisplayText) {
                console.warn("PeoplePicker: skipping result without email or display name", match.DisplayText, match.EntityData?.Email);
                return null;
            }
            this._lastSearchResults = [ match ];
            const matchIdentity = UserIdentity.fromSearchResult(match);
            const option = {
                label: match.DisplayText,
                value: matchIdentity,
                checked: true
            };
            if (this._isMultiple) {
                const alreadyPresent = this._dataset.some(o => o.checked && o.value.email === matchIdentity.email);
                if (!alreadyPresent) {
                    this._dataset.push(option);
                    this._filteredDataset = this._dataset;
                    this._value.value = this._dataset.filter(o => o.checked);
                    this.render();
                }
            } else {
                this._value.value = option;
                this.dataset = [ option ];
            }
            return match;
        } finally {
            if (this.isAlive) {
                this._setLoading(false);
            }
        }
    }
    get selectedIdentity() {
        const val = this._value.value;
        if (!val || Array.isArray(val)) return null;
        return val.value ?? null;
    }
    get selectedIdentities() {
        const val = this._value.value;
        if (!val) return [];
        const items = Array.isArray(val) ? val : [ val ];
        return items.map(opt => opt.value).filter(id => id != null);
    }
    get queryResults() {
        return this._lastSearchResults;
    }
}

dayjs.extend(customParseFormat);

const FORMAT_MAP = {
    "dd-mm-yyyy": "DD-MM-YYYY",
    "mm-dd-yyyy": "MM-DD-YYYY",
    "yyyy-mm-dd": "YYYY-MM-DD"
};

class DateInput extends FormControl {
    constructor(fieldOrValue, props = {}) {
        super(fieldOrValue, props);
        this._pendingTimeouts = new Set;
        this.format = props.format ?? "dd-mm-yyyy";
        this._placeholder = props.placeholder ?? this.format.toUpperCase();
        this._dayjsFormat = FORMAT_MAP[this.format];
        this._viewDate = dayjs();
        this._selectedDate = null;
        this._isCalendarOpen = false;
    }
    get labelTarget() {
        return `${this.id}-input`;
    }
    get defaultLabelPosition() {
        return "top";
    }
    _trackTimeout(fn, ms) {
        const id = setTimeout(() => {
            this._pendingTimeouts.delete(id);
            fn();
        }, ms);
        this._pendingTimeouts.add(id);
        return id;
    }
    _clearAllTimeouts() {
        this._pendingTimeouts.forEach(clearTimeout);
        this._pendingTimeouts.clear();
    }
    _createCalendarPanel() {
        return `<div class="${this.topClassBEM}__calendar" style="display:none">\n      <div class="${this.topClassBEM}__calendar__header">\n        <button class="${this.topClassBEM}__calendar__prev" type="button">${getIcon("arrow-left-s-line")}</button>\n        <span class="${this.topClassBEM}__calendar__title">${this._viewDate.format("MMMM YYYY")}</span>\n        <button class="${this.topClassBEM}__calendar__next" type="button">${getIcon("arrow-right-s-line")}</button>\n      </div>\n      <table class="${this.topClassBEM}__calendar__grid">\n        <thead>\n          <tr>\n            <th>Su</th><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th>\n          </tr>\n        </thead>\n        <tbody>${this._createCalendarBody()}</tbody>\n      </table>\n      <div class="${this.topClassBEM}__calendar__footer">\n        <button class="${this.topClassBEM}__calendar__today" type="button">Today</button>\n      </div>\n    </div>`;
    }
    _createCalendarBody() {
        const firstOfMonth = this._viewDate.startOf("month");
        const daysInMonth = this._viewDate.daysInMonth();
        const startWeekday = firstOfMonth.day();
        const today = dayjs();
        const bemDay = `${this.topClassBEM}__calendar__day`;
        let html = "<tr>";
        let cellCount = 0;
        for (let i = 0; i < startWeekday; i++) {
            html += `<td class="${bemDay} ${bemDay}--empty"></td>`;
            cellCount++;
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = this._viewDate.date(day);
            const dateStr = currentDate.format("YYYY-MM-DD");
            const mods = [];
            if (currentDate.isSame(today, "day")) {
                mods.push(`${bemDay}--today`);
            }
            if (this._selectedDate && currentDate.isSame(this._selectedDate, "day")) {
                mods.push(`${bemDay}--selected`);
            }
            html += `<td class="${bemDay} ${mods.join(" ")}" data-date="${dateStr}">${day}</td>`;
            cellCount++;
            if (cellCount % 7 === 0 && day < daysInMonth) {
                html += "</tr><tr>";
            }
        }
        const remaining = cellCount % 7;
        if (remaining > 0) {
            for (let i = remaining; i < 7; i++) {
                html += `<td class="${bemDay} ${bemDay}--empty"></td>`;
            }
        }
        html += "</tr>";
        return html;
    }
    _openCalendar() {
        this._refreshCalendarContent();
        this.instance?.addClass(`${this.topClassBEM}--open`);
        this.instance?.find(`.${this.topClassBEM}__calendar`).stop(true, true).slideDown();
        this._isCalendarOpen = true;
    }
    _closeCalendar() {
        this.instance?.find(`.${this.topClassBEM}__calendar`).stop(true, true).slideUp();
        const duration = 300;
        this._trackTimeout(() => this.instance?.removeClass(`${this.topClassBEM}--open`), duration);
        this._isCalendarOpen = false;
    }
    _refreshCalendarContent() {
        this.instance?.find(`.${this.topClassBEM}__calendar__title`).text(this._viewDate.format("MMMM YYYY"));
        this.instance?.find(`.${this.topClassBEM}__calendar__grid tbody`).html(this._createCalendarBody());
        this._bindDayClickHandlers();
    }
    _syncValueFromInput() {
        const input = this.instance?.find(`.${this.topClassBEM}__input`);
        const raw = input?.val()?.toString() ?? "";
        if (!raw) {
            this._selectedDate = null;
            this._value.value = "";
        } else {
            const parsed = dayjs(raw, this._dayjsFormat, true);
            if (parsed.isValid()) {
                this._selectedDate = parsed;
                this._viewDate = parsed;
                this._value.value = parsed.format(this._dayjsFormat);
                input?.val(this._value.value);
            } else {
                this._selectedDate = null;
                this._value.value = raw;
            }
        }
        if (this._value.wasTouched) this._validate();
    }
    _applyDateSelection(date) {
        this._selectedDate = date;
        this._viewDate = date;
        this._value.value = date.format(this._dayjsFormat);
        this._closeCalendar();
        this.instance?.find(`.${this.topClassBEM}__input`).val(this._value.value);
        if (this._value.wasTouched) this._validate();
    }
    _bindDayClickHandlers() {
        const bemDay = `${this.topClassBEM}__calendar__day`;
        const daySelector = `.${bemDay}:not(.${bemDay}--empty)`;
        this._addManagedListener("click", e => {
            e.stopPropagation();
            const dateStr = $(e.target).closest("[data-date]").attr("data-date");
            if (dateStr) this._applyDateSelection(dayjs(dateStr));
        }, daySelector);
    }
    _applyEventListeners() {
        super._applyEventListeners();
        this._addManagedListener("click", () => {
            if (!this._isDisabled && !this._isCalendarOpen) this._openCalendar();
        }, `.${this.topClassBEM}__input-wrapper`);
        this._addManagedListener("blur", () => {
            this._trackTimeout(() => this._syncValueFromInput(), 150);
        }, `.${this.topClassBEM}__input`);
        this._addManagedListener("keydown", e => {
            if (e.originalEvent?.key === "Escape") this._closeCalendar();
        });
        this._addManagedListener("click", e => {
            e.stopPropagation();
            this._viewDate = this._viewDate.subtract(1, "month");
            this._refreshCalendarContent();
        }, `.${this.topClassBEM}__calendar__prev`);
        this._addManagedListener("click", e => {
            e.stopPropagation();
            this._viewDate = this._viewDate.add(1, "month");
            this._refreshCalendarContent();
        }, `.${this.topClassBEM}__calendar__next`);
        this._addManagedListener("click", e => {
            e.stopPropagation();
            this._applyDateSelection(dayjs());
        }, `.${this.topClassBEM}__calendar__today`);
        this._addManagedListener("focusout", () => {
            this._trackTimeout(() => {
                const active = document.activeElement;
                if (!this.instance?.[0]?.contains(active)) {
                    this._closeCalendar();
                }
            }, 0);
        });
        this._bindDayClickHandlers();
    }
    set isDisabled(flag) {
        if (this._isCalendarOpen) {
            this._closeCalendar();
            this._isCalendarOpen = false;
        }
        super.isDisabled = flag;
    }
    get isDisabled() {
        return super.isDisabled;
    }
    set isLoading(flag) {
        if (flag && this._isCalendarOpen) {
            this._closeCalendar();
            this._isCalendarOpen = false;
        }
        super.isLoading = flag;
    }
    get isLoading() {
        return super.isLoading;
    }
    get modifierClasses() {
        const mods = [ super.modifierClasses ];
        if (this._isCalendarOpen) mods.push(`${this.topClassBEM}--open`);
        return mods.join(" ");
    }
    toString() {
        return `<div\n      id="${this.id}"\n      class="${this.class} ${this.modifierClasses}"\n      tabindex="-1"\n    >\n      <div class="${this.topClassBEM}__input-wrapper">\n        <input\n          id="${this.id}-input"\n          class="${this.topClassBEM}__input"\n          type="text"\n          autocomplete="off"\n          placeholder="${escapeAttr(this._placeholder)}"\n          value="${escapeAttr(this._selectedDate ? this._selectedDate.format(this._dayjsFormat) : this._value.value)}"\n          ${this._isDisabled ? "disabled" : ""}\n        />\n        <span class="${this.topClassBEM}__icon">\n          ${getIcon("calendar-line")}\n        </span>\n      </div>\n      ${this._createCalendarPanel()}\n    </div>`;
    }
    render() {
        super.render(false);
    }
    remove() {
        this._clearAllTimeouts();
        super.remove();
    }
}

class DateRangeInput extends HTMDElement {
    constructor(startField, endField, props = {}) {
        super(undefined, props);
        this._pendingTimeouts = new Set;
        this.startField = startField;
        this.endField = endField;
        this._format = props.format ?? "dd-mm-yyyy";
        this._dayjsFormat = FORMAT_MAP[this._format];
        this._placeholder = props.placeholder ?? "Select date range";
        this._summaryLabel = props.summaryLabel ?? "days";
        this._rules = props.rules ?? {};
        this._isDisabled = props.isDisabled ?? false;
        if (this._rules.minDays != null && this._rules.maxDays != null && this._rules.minDays > this._rules.maxDays) {
            throw new SystemError("DateRangeInput", "minDays cannot exceed maxDays");
        }
        this._minDate = this._rules.minDate ? dayjs(this._rules.minDate, this._dayjsFormat, true) : null;
        this._maxDate = this._rules.maxDate ? dayjs(this._rules.maxDate, this._dayjsFormat, true) : null;
        if (this._minDate && !this._minDate.isValid()) this._minDate = null;
        if (this._maxDate && !this._maxDate.isValid()) this._maxDate = null;
        if (this._minDate && this._maxDate && this._minDate.isAfter(this._maxDate)) {
            throw new SystemError("DateRangeInput", "minDate cannot be after maxDate");
        }
        this._startDate = this._parseFieldValue(startField.value);
        this._endDate = this._parseFieldValue(endField.value);
        this._viewDate = this._startDate ? this._startDate.startOf("month") : dayjs().startOf("month");
        this._selectingEnd = false;
        this._hoverDate = null;
        this._isPanelOpen = false;
        this._syncing = false;
        this._unsubStart = null;
        this._unsubEnd = null;
        this._unsubStart = startField.subscribe(() => this._onExternalFieldChange("start"));
        this._unsubEnd = endField.subscribe(() => this._onExternalFieldChange("end"));
    }
    get isDisabled() {
        return this._isDisabled;
    }
    set isDisabled(value) {
        this._isDisabled = value;
        if (!this.isAlive) return;
        const bem = this.topClassBEM;
        if (value) {
            this.instance?.addClass(`${bem}--disabled`);
            this.instance?.find(`.${bem}__input`).attr("disabled", "disabled");
        } else {
            this.instance?.removeClass(`${bem}--disabled`);
            this.instance?.find(`.${bem}__input`).removeAttr("disabled");
        }
    }
    open() {
        if (!this._isDisabled) this._openPanel();
    }
    close() {
        this._closePanel();
    }
    _trackTimeout(fn, ms) {
        const id = setTimeout(() => {
            this._pendingTimeouts.delete(id);
            fn();
        }, ms);
        this._pendingTimeouts.add(id);
        return id;
    }
    _clearAllTimeouts() {
        this._pendingTimeouts.forEach(clearTimeout);
        this._pendingTimeouts.clear();
    }
    _parseFieldValue(value) {
        if (!value) return null;
        const parsed = dayjs(value, this._dayjsFormat, true);
        return parsed.isValid() ? parsed : null;
    }
    _isDateDisabled(date) {
        if (this._minDate && date.isBefore(this._minDate, "day")) return true;
        if (this._maxDate && date.isAfter(this._maxDate, "day")) return true;
        if (this._selectingEnd && this._startDate) {
            const diff = Math.abs(date.diff(this._startDate, "day"));
            if (this._rules.maxDays != null && diff > this._rules.maxDays) return true;
            if (this._rules.minDays != null && diff < this._rules.minDays && diff !== 0) return true;
        }
        return false;
    }
    _createMonthBody(monthDate) {
        const firstOfMonth = monthDate.startOf("month");
        const daysInMonth = monthDate.daysInMonth();
        const startWeekday = firstOfMonth.day();
        const today = dayjs();
        const bemDay = `${this.topClassBEM}__panel__day`;
        let html = "<tr>";
        let cellCount = 0;
        for (let i = 0; i < startWeekday; i++) {
            html += `<td class="${bemDay} ${bemDay}--empty"></td>`;
            cellCount++;
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = monthDate.date(day);
            const dateStr = currentDate.format("YYYY-MM-DD");
            const mods = [];
            if (currentDate.isSame(today, "day")) {
                mods.push(`${bemDay}--today`);
            }
            if (this._startDate && currentDate.isSame(this._startDate, "day")) {
                mods.push(`${bemDay}--start`);
            }
            if (this._endDate && currentDate.isSame(this._endDate, "day")) {
                mods.push(`${bemDay}--end`);
            }
            if (this._startDate && this._endDate && currentDate.isAfter(this._startDate, "day") && currentDate.isBefore(this._endDate, "day")) {
                mods.push(`${bemDay}--in-range`);
            }
            if (this._isDateDisabled(currentDate)) {
                mods.push(`${bemDay}--disabled`);
            }
            html += `<td class="${bemDay} ${mods.join(" ")}" data-date="${dateStr}">${day}</td>`;
            cellCount++;
            if (cellCount % 7 === 0 && day < daysInMonth) {
                html += "</tr><tr>";
            }
        }
        const remaining = cellCount % 7;
        if (remaining > 0) {
            for (let i = remaining; i < 7; i++) {
                html += `<td class="${bemDay} ${bemDay}--empty"></td>`;
            }
        }
        html += "</tr>";
        return html;
    }
    _createPanel() {
        const bem = this.topClassBEM;
        const leftMonth = this._viewDate;
        const rightMonth = this._viewDate.add(1, "month");
        const weekHeader = "<thead><tr>" + "<th>Su</th><th>Mo</th><th>Tu</th><th>We</th><th>Th</th><th>Fr</th><th>Sa</th>" + "</tr></thead>";
        return `<div class="${bem}__panel" style="display:none">\n      <div class="${bem}__panel__header">\n        <button class="${bem}__panel__prev" type="button">${getIcon("arrow-left-s-line")}</button>\n        <span class="${bem}__panel__title">${leftMonth.format("MMMM YYYY")}</span>\n        <span class="${bem}__panel__title">${rightMonth.format("MMMM YYYY")}</span>\n        <button class="${bem}__panel__next" type="button">${getIcon("arrow-right-s-line")}</button>\n      </div>\n      <div class="${bem}__panel__calendars">\n        <table class="${bem}__panel__grid">${weekHeader}<tbody>${this._createMonthBody(leftMonth)}</tbody></table>\n        <table class="${bem}__panel__grid">${weekHeader}<tbody>${this._createMonthBody(rightMonth)}</tbody></table>\n      </div>\n      <div class="${bem}__panel__footer">\n        <span class="${bem}__panel__summary">${this._createSummaryText()}</span>\n      </div>\n    </div>`;
    }
    _getInputDisplayValue() {
        if (this._startDate && this._endDate) {
            return `${this._startDate.format(this._dayjsFormat)} – ${this._endDate.format(this._dayjsFormat)}`;
        }
        if (this._startDate) {
            return `${this._startDate.format(this._dayjsFormat)} – ...`;
        }
        return "";
    }
    _createSummaryText() {
        if (!this._startDate || !this._endDate) return "";
        const days = Math.abs(this._endDate.diff(this._startDate, "day"));
        return `${this._startDate.format("ddd, MMM D")} – ${this._endDate.format("ddd, MMM D")} (${days} ${this._summaryLabel})`;
    }
    _syncInputDisplay() {
        if (!this.isAlive) return;
        const bem = this.topClassBEM;
        this.instance?.find(`.${bem}__input`).val(this._getInputDisplayValue());
        this.instance?.find(`.${bem}__panel__summary`).text(this._createSummaryText());
    }
    _openPanel() {
        if (this._isPanelOpen) return;
        if (this._startDate) {
            this._viewDate = this._startDate.startOf("month");
        }
        this._refreshPanelContent();
        this.instance?.addClass(`${this.topClassBEM}--open`);
        this.instance?.find(`.${this.topClassBEM}__panel`).stop(true, true).slideDown();
        this._isPanelOpen = true;
    }
    _closePanel() {
        if (!this._isPanelOpen) return;
        this.instance?.find(`.${this.topClassBEM}__panel`).stop(true, true).slideUp();
        const duration = 300;
        this._trackTimeout(() => this.instance?.removeClass(`${this.topClassBEM}--open`), duration);
        this._isPanelOpen = false;
        this._selectingEnd = false;
        this._hoverDate = null;
    }
    _refreshPanelContent() {
        const bem = this.topClassBEM;
        const leftMonth = this._viewDate;
        const rightMonth = this._viewDate.add(1, "month");
        const titles = this.instance?.find(`.${bem}__panel__title`);
        titles?.eq(0).text(leftMonth.format("MMMM YYYY"));
        titles?.eq(1).text(rightMonth.format("MMMM YYYY"));
        const grids = this.instance?.find(`.${bem}__panel__grid tbody`);
        grids?.eq(0).html(this._createMonthBody(leftMonth));
        grids?.eq(1).html(this._createMonthBody(rightMonth));
        this.instance?.find(`.${bem}__panel__summary`).text(this._createSummaryText());
        this._bindDayHandlers();
    }
    _onDayClick(dateStr) {
        const clicked = dayjs(dateStr);
        if (!this._selectingEnd) {
            this._startDate = clicked;
            this._endDate = null;
            this._selectingEnd = true;
            this._refreshPanelContent();
            this._syncInputDisplay();
        } else {
            if (this._isDateDisabled(clicked)) return;
            if (this._startDate && clicked.isBefore(this._startDate, "day")) {
                this._endDate = this._startDate;
                this._startDate = clicked;
            } else {
                this._endDate = clicked;
            }
            this._syncing = true;
            try {
                this.startField.value = this._startDate.format(this._dayjsFormat);
                this.endField.value = this._endDate.format(this._dayjsFormat);
            } finally {
                this._syncing = false;
            }
            this._selectingEnd = false;
            this._hoverDate = null;
            this._syncInputDisplay();
            this._closePanel();
        }
    }
    _applyHoverPreview(dateStr) {
        if (!this._selectingEnd || !this._startDate) return;
        this._hoverDate = dateStr;
        const hoverDate = dayjs(dateStr);
        if (this._isDateDisabled(hoverDate)) {
            this._clearHoverPreview();
            return;
        }
        const bemDay = `${this.topClassBEM}__panel__day`;
        const startStr = this._startDate.format("YYYY-MM-DD");
        const rangeStart = hoverDate.isBefore(this._startDate, "day") ? dateStr : startStr;
        const rangeEnd = hoverDate.isBefore(this._startDate, "day") ? startStr : dateStr;
        this.instance?.find(`[data-date]`).each((_, el) => {
            const $el = $(el);
            const cellDate = $el.attr("data-date");
            $el.removeClass(`${bemDay}--hover-range ${bemDay}--hover-end`);
            if (cellDate > rangeStart && cellDate < rangeEnd) {
                $el.addClass(`${bemDay}--hover-range`);
            }
            if (cellDate === dateStr && dateStr !== startStr) {
                $el.addClass(`${bemDay}--hover-end`);
            }
        });
        this._updateHoverSummary(hoverDate);
    }
    _clearHoverPreview() {
        const bemDay = `${this.topClassBEM}__panel__day`;
        this.instance?.find(`.${bemDay}--hover-range, .${bemDay}--hover-end`).removeClass(`${bemDay}--hover-range ${bemDay}--hover-end`);
        this._hoverDate = null;
        this.instance?.find(`.${this.topClassBEM}__panel__summary`).text(this._createSummaryText());
    }
    _updateHoverSummary(hoverDate) {
        if (!this._startDate) return;
        const bem = this.topClassBEM;
        let previewStart = this._startDate;
        let previewEnd = hoverDate;
        if (hoverDate.isBefore(this._startDate, "day")) {
            previewStart = hoverDate;
            previewEnd = this._startDate;
        }
        const days = Math.abs(previewEnd.diff(previewStart, "day"));
        const text = `${previewStart.format("ddd, MMM D")} – ${previewEnd.format("ddd, MMM D")} (${days} ${this._summaryLabel})`;
        this.instance?.find(`.${bem}__panel__summary`).text(text);
    }
    _bindDayHandlers() {
        const bemDay = `${this.topClassBEM}__panel__day`;
        const daySelector = `.${bemDay}:not(.${bemDay}--empty)`;
        this.instance?.find(daySelector).each((_, el) => {
            const $el = $(el);
            $el.off("click.daterange mouseenter.daterange");
            $el.on("click.daterange", e => {
                e.stopPropagation();
                const dateStr = $el.attr("data-date");
                if (dateStr) this._onDayClick(dateStr);
            });
            $el.on("mouseenter.daterange", () => {
                const dateStr = $el.attr("data-date");
                if (dateStr) this._applyHoverPreview(dateStr);
            });
        });
    }
    _applyEventListeners() {
        super._applyEventListeners();
        const bem = this.topClassBEM;
        this._addManagedListener("click", () => {
            if (this._isDisabled) return;
            if (this._isPanelOpen) {
                this._closePanel();
            } else {
                this._openPanel();
            }
        }, `.${bem}__input-wrapper`);
        this._addManagedListener("click", e => {
            e.stopPropagation();
            this._viewDate = this._viewDate.subtract(1, "month");
            this._refreshPanelContent();
        }, `.${bem}__panel__prev`);
        this._addManagedListener("click", e => {
            e.stopPropagation();
            this._viewDate = this._viewDate.add(1, "month");
            this._refreshPanelContent();
        }, `.${bem}__panel__next`);
        this._bindDayHandlers();
        this._addManagedListener("mouseleave", () => {
            this._clearHoverPreview();
        }, `.${bem}__panel`);
        this._addManagedListener("keydown", e => {
            if (e.originalEvent?.key === "Escape") this._closePanel();
        });
        this._addManagedListener("focusout", () => {
            this._trackTimeout(() => {
                const active = document.activeElement;
                if (!this.instance?.[0]?.contains(active)) {
                    this._closePanel();
                }
            }, 0);
        });
    }
    _onExternalFieldChange(which) {
        if (this._syncing) return;
        if (which === "start") {
            this._startDate = this._parseFieldValue(this.startField.value);
        } else {
            this._endDate = this._parseFieldValue(this.endField.value);
        }
        if (which === "start" && this._startDate) {
            this._viewDate = this._startDate.startOf("month");
        }
        if (this.isAlive && !this._isPanelOpen) {
            this._syncInputDisplay();
        }
    }
    toString() {
        const bem = this.topClassBEM;
        const disabledMod = this._isDisabled ? ` ${bem}--disabled` : "";
        const openMod = this._isPanelOpen ? ` ${bem}--open` : "";
        return `<div\n      id="${this.id}"\n      class="${this.class} form-control${disabledMod}${openMod}"\n      tabindex="-1"\n    >\n      <div class="${bem}__input-wrapper">\n        <input\n          class="${bem}__input"\n          type="text"\n          readonly\n          placeholder="${escapeAttr(this._placeholder)}"\n          value="${escapeAttr(this._getInputDisplayValue())}"\n          ${this._isDisabled ? "disabled" : ""}\n        />\n        <span class="${bem}__icon">${getIcon("calendar-line")}</span>\n      </div>\n      ${this._createPanel()}\n    </div>`;
    }
    render() {
        super.render(false);
    }
    remove() {
        if (this._unsubStart) this._unsubStart();
        if (this._unsubEnd) this._unsubEnd();
        this._unsubStart = null;
        this._unsubEnd = null;
        this._clearAllTimeouts();
        super.remove();
    }
}

class NumberInput extends DebouncedInput {
    constructor(fieldOrValue, props) {
        super(fieldOrValue, props);
        this.min = props?.min;
        this.step = props?.step;
        this.max = props?.max;
    }
    _syncValue() {
        const raw = this.instance?.val();
        if (raw == null || raw === "") return;
        this._value.value = Number(raw);
        this._validate();
    }
    toString() {
        const addAttrFromProp = prop => this[prop] != null ? `${prop}="${this[prop]}"` : "";
        return `<input\n                    title="${escapeAttr(String(this.value))}"\n                    id="${this.id}"\n                    class="${this.class} ${super.modifierClasses}"\n                    type="number"\n                    autocomplete="off"\n                    tabindex=0\n                    ${this.isDisabled ? "disabled" : ""}\n                    value="${escapeAttr(String(this._value.value))}"\n                    ${addAttrFromProp("min")}\n                    ${addAttrFromProp("step")}\n                    ${addAttrFromProp("max")}\n                    />`;
    }
}

class TextArea extends DebouncedInput {
    constructor(fieldOrValue, props = {}) {
        super(fieldOrValue, props);
        this.placeholder = props?.placeholder ?? "";
        this.spellcheck = props?.spellcheck ?? false;
        this.autocomplete = props?.autocomplete ?? false;
        this.rows = props?.rows ?? 4;
        this.maxLength = props?.maxLength;
        this.resize = props?.resize ?? "vertical";
        this.autoResize = props?.autoResize ?? false;
    }
    _syncValue() {
        this._value.value = this.instance?.val();
        this._validate();
    }
    _autoResize() {
        const el = this.instance?.[0];
        if (!el) return;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
    }
    _onInput() {
        if (this.autoResize) this._autoResize();
    }
    toString() {
        const addAttrFromProp = (attr, value) => value != null ? `${attr}="${value}"` : "";
        return `<textarea\n                    title="${escapeAttr(String(this.value))}"\n                    id="${this.id}"\n                    class="${this.class} ${super.modifierClasses}"\n                    tabindex=0\n                    spellcheck="${this.spellcheck}"\n                    autocomplete="${this.autocomplete ? "on" : "off"}"\n                    rows="${this.rows}"\n                    style="resize: ${this.resize}"\n                    ${this.isDisabled ? "disabled" : ""}\n                    ${this.placeholder ? `placeholder="${escapeAttr(this.placeholder)}"` : ""}\n                    ${addAttrFromProp("maxlength", this.maxLength)}\n>${escapeHtml(this._value.value)}</textarea>`;
    }
}

class TextInput extends DebouncedInput {
    constructor(fieldOrValue, props) {
        super(fieldOrValue, props);
        this.spellcheck = props?.spellcheck ?? false;
        this.autocomplete = props?.autocomplete ?? false;
        this.hideChars = props?.hideChars ?? false;
        this.placeholder = props?.placeholder ?? "";
    }
    _syncValue() {
        this._value.value = this.instance?.val();
        this._validate();
    }
    toString() {
        const safeValue = escapeAttr(String(this.value).trim());
        return `<input\n                    title="${safeValue}"\n                    id="${this.id}"\n                    class="${this.class} ${super.modifierClasses} "\n                    type="${this.hideChars ? "password" : "text"}"\n                    tabindex=0\n                    spellcheck="${this.spellcheck}"\n                    autocomplete="${this.autocomplete ? "on" : "off"}"\n                    ${this.isDisabled ? "disabled" : ""}\n                    ${this.placeholder ? `placeholder="${escapeAttr(this.placeholder)}"` : ""}\n                    value="${safeValue}"\n                    />`;
    }
}

class CheckBox extends FormControl {
    constructor(fieldOrValue, props) {
        super(fieldOrValue, props);
    }
    get labelTarget() {
        return `${this.id}-input`;
    }
    get defaultLabelPosition() {
        return "left";
    }
    _applyEventListeners() {
        super._applyEventListeners();
        this.setEventHandler("change", e => {
            if (!(e.target instanceof HTMLInputElement)) return;
            this._value.value = e.target.checked;
            this._validate();
        });
    }
    toString() {
        return `<label\n                 id="${this.id}"\n                 class="${this.class} ${super.modifierClasses} "\n                 tabindex=0\n             >\n                 <input id="${this.id}-input" type="checkbox" ${this._value.value ? "checked" : ""}/>\n                 ${getIcon("check-line")}\n             </label>`;
    }
}

class List extends HTMDElement {
    constructor(props) {
        super(undefined, props);
        this.headers = props.headers || [];
        this._data = props.data || [];
        this._orderedData = this._data;
        this.throwOnInvalidListData();
        this.emptyListMessage = props?.emptyListMessage || "No items to display";
        this.onItemSelectHandler = props?.onItemSelectHandler || (() => {});
    }
    _createHeaders(data) {
        return `<tr class="${this.topClassBEM}__header ${this.topClassBEM}__row">${reduce(data, (acc, item) => acc += `<th class="${this.topClassBEM}__col " title="${escapeAttr(String(item))}">\n        <span class="${this.topClassBEM}__header__text">${escapeHtml(String(item))}</span>\n        <div class="${this.topClassBEM}__header__order-icons">\n          <span class="${this.topClassBEM}__header__ascending-icon">${getIcon("sort-asc")}</span>\n          <span class="${this.topClassBEM}__header__descending-icon">${getIcon("sort-desc")}</span>\n        </div>\n        </th>`, "")}</tr>`;
    }
    _createRow(data, emptyRow) {
        return `<tr\n              class="${this.topClassBEM}__row ${emptyRow ? `${this.topClassBEM}__row--empty` : ""}"\n            >${reduce(data, (acc, item) => acc += `<td class="${this.topClassBEM}__col" title="${escapeAttr(String(item))}" ${emptyRow ? `colspan=${this.headers.length}` : ""}>${escapeHtml(String(item))}</td>`, "")}</tr>`;
    }
    _createListItems(list = this._data) {
        return list.length === 0 ? this._createRow([ this.emptyListMessage ], true) : reduce(list, (acc, item) => acc += this._createRow(item), "");
    }
    toString() {
        return `<div id="${this.id}" class="${this.class}">\n                <table\n                    class="${this.topClassBEM}__table"\n                    tabindex='-1'\n                >\n                          <thead>${this._createHeaders(this.headers)}</thead>\n                          <tbody>${this._createListItems(this._orderedData)}</tbody>\n                </table>\n            </div>\n                `;
    }
    _refreshDataset(data) {
        this.instance?.find("tbody").html(this._createListItems(data));
    }
    _defaultOrderingFn(headerIndex, order) {
        if (order) {
            return orderBy(this._data, item => item[headerIndex], order);
        } else return this._data;
    }
    _applySortClass(element, index) {
        const ascendingClass = `${this.topClassBEM}__header--ascending`, descendingClass = `${this.topClassBEM}__header--descending`;
        const headers = this.instance?.find(`.${this.topClassBEM}__header .${this.topClassBEM}__col`);
        forEach(headers, (h, i) => {
            if (i !== index) $(h).removeClass([ ascendingClass, descendingClass ]);
        });
        if (element.hasClass(ascendingClass)) {
            element.removeClass(ascendingClass);
            element.addClass(descendingClass);
            return "desc";
        } else if (element.hasClass(descendingClass)) {
            element.removeClass(descendingClass);
            return undefined;
        } else {
            element.addClass(ascendingClass);
            return "asc";
        }
    }
    _applyHeaderSortListener() {
        const headerColSelector = `.${this.topClassBEM}__header .${this.topClassBEM}__col`;
        this._addManagedListener("click", e => {
            const th = $(e.currentTarget);
            const index = th.parent().children(`.${this.topClassBEM}__col`).index(th);
            const order = this._applySortClass(th, index);
            this._orderedData = this._defaultOrderingFn(index, order);
            this._refreshDataset(this._orderedData);
        }, headerColSelector);
    }
    _applyRowSelectListener() {
        if (!this.onItemSelectHandler || this.data.length === 0) return;
        const rowSelector = `tbody .${this.topClassBEM}__row`;
        this._addManagedListener("click", e => {
            const row = $(e.currentTarget);
            const index = this.instance?.find(rowSelector).index(row) ?? -1;
            if (index >= 0 && index < this._orderedData.length) {
                this.onItemSelectHandler(this._orderedData[index]);
            }
        }, rowSelector);
    }
    _applyEventListeners() {
        super._applyEventListeners();
        this._applyHeaderSortListener();
        this._applyRowSelectListener();
    }
    set data(data) {
        this._data = data;
        this._orderedData = data;
        this.throwOnInvalidListData();
        this._refreshDataset(data);
    }
    get data() {
        return this._data;
    }
    get isDataValid() {
        if (this._data.length === 0) return true;
        return this._data[0]?.length === this.headers.length;
    }
    throwOnInvalidListData() {
        if (!this.isDataValid) throw new SystemError("List", "List headers don't match the number of item properties", {
            breaksFlow: false
        });
    }
}

class Image extends HTMDElement {
    constructor(src, props) {
        super(undefined, props);
        this._src = src;
        this._alt = props?.alt;
        this._onLoadCallback = props?.onLoad || (() => {});
    }
    _preloader() {
        const $imgElement = this.instance?.find("img");
        if (!$imgElement) {
            console.warn("[Image._preloader] img element not found inside rendered component -- image will not load", {
                id: this.id,
                src: this._src
            });
            return;
        }
        $imgElement.on("load", () => {
            this.instance?.css("opacity", "1");
            this._onLoadCallback();
        });
        $imgElement.on("error", function() {
            console.error("Failed to load image");
        });
        $imgElement.attr("src", this._src);
    }
    render(_shouldRenderChildren) {
        super.render(false);
        this._preloader();
    }
    toString() {
        return `<div id="${this.id}" class="${this.class}"> <img alt="${escapeAttr(this._alt ?? "")}"/> </div>`;
    }
}

function runtimeEventName(className) {
    return className.toLowerCase();
}

class RuntimeEvent extends Event {
    constructor(eventTarget, options) {
        const eventType = runtimeEventName(new.target.name);
        super(eventType, {
            bubbles: options?.bubbles ?? true,
            cancelable: options?.cancelable ?? true
        });
        this._target = eventTarget;
    }
    static _createListener(eventName, callback, target, options = {
        once: false
    }) {
        const wrapperFn = e => callback(e);
        target.addEventListener(eventName, wrapperFn, options);
        return () => target.removeEventListener(eventName, wrapperFn);
    }
    dispatch() {
        return this._target.dispatchEvent(this);
    }
    get target() {
        return this._target;
    }
}

var _NavigationEvent_from, _NavigationEvent_to, _NavigationEvent_query;

class NavigationEvent extends RuntimeEvent {
    constructor(to, from, query) {
        super(window, {
            bubbles: false,
            cancelable: false
        });
        _NavigationEvent_from.set(this, void 0);
        _NavigationEvent_to.set(this, void 0);
        _NavigationEvent_query.set(this, void 0);
        __classPrivateFieldSet(this, _NavigationEvent_from, from, "f");
        __classPrivateFieldSet(this, _NavigationEvent_to, to, "f");
        __classPrivateFieldSet(this, _NavigationEvent_query, query, "f");
    }
    static listener(callback, options) {
        return RuntimeEvent._createListener(runtimeEventName(NavigationEvent.name), callback, window, options);
    }
    get to() {
        return __classPrivateFieldGet(this, _NavigationEvent_to, "f");
    }
    get from() {
        return __classPrivateFieldGet(this, _NavigationEvent_from, "f");
    }
    get query() {
        return __classPrivateFieldGet(this, _NavigationEvent_query, "f");
    }
}

_NavigationEvent_from = new WeakMap, _NavigationEvent_to = new WeakMap, _NavigationEvent_query = new WeakMap;

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        console.error("Failed to copy:", error);
        return false;
    }
}

class BreakingErrorDialog {
    constructor(error) {
        this._dialog = new Dialog({
            variant: "error",
            title: error.name,
            class: "error-dialog",
            containerSelector: "body",
            closeOnFocusLoss: false,
            content: [ new Text(error.message), new Text(error.stack, {
                class: "error-dialog__stack-trace"
            }), new Text("If this error persists, please copy the error message and send it to the support team.") ],
            footer: [ new Button("Copy Error", {
                onClickHandler: () => {
                    console.log("=== THE FOLLOWING WAS COPIED TO CLIPBOARD ===");
                    console.log(error.toJSON());
                    copyToClipboard(this._generateClipboardData(error));
                },
                variant: "secondary"
            }), new Button("Reload Page", {
                onClickHandler: () => location.reload(),
                variant: "danger"
            }) ]
        });
    }
    _generateClipboardData(error) {
        let user;
        try {
            user = new CurrentUser;
        } catch (e) {
            console.error("[BreakingErrorDialog._generateClipboardData] failed to load user data", e);
        }
        return JSON.stringify({
            error: error.toJSON(),
            user: user?.isInitialized ? {
                loginName: user.get("loginName"),
                displayName: user.get("displayName"),
                email: user.get("email")
            } : null
        });
    }
    render() {
        this._dialog.render();
        this._dialog.open();
    }
}

class ErrorBoundary {
    constructor(props) {
        this._targetElement = props?.target || window;
        this._onErrorCallback = props?.onErrorCallback;
        this._onAsyncErrorCallback = props?.onAsyncErrorCallback;
        this._name = props?.name || generateRuntimeUID(`error-boundary`);
        this._boundErrorHandler = e => this._onErrorEventHandler(e);
        this._boundRejectionHandler = e => this._onAsyncErrorEventHandler(e);
        this._addEventListeners();
    }
    async _displayError(error) {
        if (error.breaksFlow) {
            console.error("[ErrorBoundary._displayError] breaking error -- rendering BreakingErrorDialog", error);
            new BreakingErrorDialog(error).render();
        } else {
            console.error(error);
            Toast.error(error.message);
        }
    }
    _parseEventData(event) {
        if (event instanceof ErrorEvent && event.error instanceof Error) {
            return SystemError.fromErrorEvent(event);
        }
        if (event instanceof ErrorEvent) {
            const msg = [ event.message, event.filename ? `at ${event.filename}:${event.lineno}:${event.colno}` : "" ].filter(Boolean).join(" ");
            return new SystemError("ScriptError", msg || "An unhandled script error occurred", {
                cause: event
            });
        }
        const type = event.type ?? "unknown";
        const target = event.target?.tagName?.toLowerCase() ?? "unknown";
        return new SystemError("ResourceError", `Unhandled ${type} event on <${target}>`, {
            cause: event
        });
    }
    _onErrorEventHandler(e) {
        console.warn(`Error caught by ${this._name} ErrorBoundary`);
        console.error(e);
        const error = this._parseEventData(e);
        this._displayError(error);
        e.preventDefault();
        if (this._onErrorCallback) this._onErrorCallback(e);
    }
    _onAsyncErrorEventHandler(e) {
        console.warn(`Unhandled promise rejection caught by ${this._name} ErrorBoundary`);
        const reason = e.reason;
        let error;
        if (reason instanceof SystemError) {
            error = reason;
        } else if (reason instanceof Error) {
            error = new SystemError(reason.name || "UnhandledRejection", reason.message, {
                cause: reason
            });
            error.stack = reason.stack;
        } else {
            const msg = reason != null ? `Unhandled rejection: ${String(reason)}` : "Unhandled promise rejection with no reason";
            error = new SystemError("UnhandledRejection", msg, {
                cause: reason
            });
        }
        if (!error.breaksFlow) {
            console.error("[ErrorBoundary] non-breaking unhandled rejection", error);
        }
        this._displayError(error);
        e.preventDefault();
        if (this._onAsyncErrorCallback) this._onAsyncErrorCallback(e);
    }
    _addEventListeners() {
        this._targetElement.addEventListener("error", this._boundErrorHandler);
        this._targetElement.addEventListener("unhandledrejection", this._boundRejectionHandler);
    }
    dispose() {
        this._targetElement.removeEventListener("error", this._boundErrorHandler);
        this._targetElement.removeEventListener("unhandledrejection", this._boundRejectionHandler);
    }
}

function resolvePath(path, {useSiteRoot: useSiteRoot = false, customPath: customPath} = {
    useSiteRoot: false,
    customPath: "SiteAssets/app"
}) {
    if (typeof path !== "string" || path.trim() === "") throw new SystemError("Invalid Path", "Path must be a non-empty string");
    return path.replace(/^@/, useSiteRoot ? _spPageContextInfo.webAbsoluteUrl : `${_spPageContextInfo.webAbsoluteUrl}/${customPath}`);
}

class StyleResource {
    constructor(path, options) {
        this._link = null;
        this._path = resolvePath(path);
        this.ready = this._loadFile(options?.enable);
        this.ready.catch(() => {});
    }
    _loadFile(enabled = true) {
        return new Promise((resolve, reject) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = this._path;
            if (!enabled) link.disabled = true;
            link.onload = () => resolve();
            link.onerror = () => {
                link.remove();
                this._link = null;
                const err = new SystemError("StyleResourceLoadError", `Failed to load stylesheet: ${this._path}`, {
                    breaksFlow: false
                });
                console.error("[StyleResource._loadFile] stylesheet load failed", {
                    path: this._path,
                    err: err
                });
                reject(err);
            };
            document.head.appendChild(link);
            this._link = link;
        });
    }
    disable() {
        if (this._link) this._link.disabled = true;
    }
    enable() {
        if (this._link) this._link.disabled = false;
    }
    remove() {
        if (this._link) {
            this._link.remove();
            this._link = null;
        }
    }
}

class Route extends View {
    constructor(props = {}) {
        super(props?.children ?? [], props);
        this.title = props.title ?? _spPageContextInfo?.webTitle ?? $(`head title`)[0].textContent ?? "undefined";
        this._routeStyle = props?.routeStylePath ? new StyleResource(props.routeStylePath) : undefined;
    }
    registerCleanupRunner(fn) {
        this._cleanupRunner = fn;
    }
    remove() {
        this._cleanupRunner?.();
        super.remove();
    }
    hide(duration, onCompleteCallback) {
        return super.hide(duration, () => {
            this._routeStyle?.disable();
            if (onCompleteCallback) onCompleteCallback();
        });
    }
    async show(duration, onCompleteCallback) {
        if (this._routeStyle) {
            await this._routeStyle.ready.catch(err => {
                console.warn("[Route.show] route style failed to load", err);
            });
        }
        this._routeStyle?.enable();
        return super.show(duration, () => {
            if (onCompleteCallback) onCompleteCallback();
        });
    }
    set routeStylePath(path) {
        if (this._routeStyle) this._routeStyle.remove();
        this._routeStyle = new StyleResource(path);
    }
    set onRefreshHandler(callback) {
        this._onRefresh = callback;
    }
}

var _Router_instances, _a$1, _Router_containerSelector, _Router_routesMap, _Router_routePaths, _Router_errorBoundary, _Router_navigationId, _Router_lastPath, _Router_notFoundRoute, _Router_unauthorizedRoute, _Router_navigationGuard, _Router_beforeUnloadHandler, _Router_routerReady, _Router_guardInFlight, _Router_checkSingletonInstance, _Router_createUrls;

class Router {
    static navigateTo(path, options) {
        __classPrivateFieldGet(_a$1, _a$1, "m", _Router_checkSingletonInstance).call(_a$1);
        _a$1._runtimeInstance._navigateTo(path, options);
    }
    static goBack() {
        history.back();
    }
    static popLevel(x = 1) {
        __classPrivateFieldGet(_a$1, _a$1, "m", _Router_checkSingletonInstance).call(_a$1);
        _a$1._runtimeInstance._popLevel(x);
    }
    static unauthorized() {
        var _b, _c;
        __classPrivateFieldGet(_a$1, _a$1, "m", _Router_checkSingletonInstance).call(_a$1);
        _a$1.clearNavigationGuard();
        const instance = _a$1._runtimeInstance;
        const navId = __classPrivateFieldSet(_b = instance, _Router_navigationId, (_c = __classPrivateFieldGet(_b, _Router_navigationId, "f"), 
        ++_c), "f");
        const outgoing = __classPrivateFieldGet(instance, _Router_lastPath, "f") ? __classPrivateFieldGet(instance, _Router_routesMap, "f").get(__classPrivateFieldGet(instance, _Router_lastPath, "f")) : undefined;
        if (outgoing?.isAlive) outgoing.remove();
        instance._cleanup();
        if (navId !== __classPrivateFieldGet(instance, _Router_navigationId, "f")) return;
        instance._applyRoute(__classPrivateFieldGet(instance, _Router_unauthorizedRoute, "f"));
    }
    static setNavigationGuard(guardFn) {
        __classPrivateFieldGet(_a$1, _a$1, "m", _Router_checkSingletonInstance).call(_a$1);
        const instance = _a$1._runtimeInstance;
        _a$1.clearNavigationGuard();
        __classPrivateFieldSet(instance, _Router_navigationGuard, guardFn, "f");
        __classPrivateFieldSet(instance, _Router_beforeUnloadHandler, e => {
            const result = guardFn();
            if (result !== true) {
                e.preventDefault();
            }
        }, "f");
        window.addEventListener("beforeunload", __classPrivateFieldGet(instance, _Router_beforeUnloadHandler, "f"));
    }
    static clearNavigationGuard() {
        __classPrivateFieldGet(_a$1, _a$1, "m", _Router_checkSingletonInstance).call(_a$1);
        const instance = _a$1._runtimeInstance;
        if (__classPrivateFieldGet(instance, _Router_beforeUnloadHandler, "f")) {
            window.removeEventListener("beforeunload", __classPrivateFieldGet(instance, _Router_beforeUnloadHandler, "f"));
        }
        __classPrivateFieldSet(instance, _Router_navigationGuard, undefined, "f");
        __classPrivateFieldSet(instance, _Router_beforeUnloadHandler, undefined, "f");
    }
    static isExternalUrl(path) {
        return /^(https?:\/\/|\/\/|mailto:|tel:)/.test(path);
    }
    static get location() {
        return location.hash.replace(/^#\//, "") || "/";
    }
    static get absoluteURI() {
        return location.href;
    }
    static get siteRootPath() {
        return _spPageContextInfo.webAbsoluteUrl;
    }
    static get pageRootPath() {
        return _a$1.absoluteURI.split(/[#?]/)[0];
    }
    static get queryParams() {
        return new URLSearchParams(window.location.search);
    }
    constructor(routeRelativePaths, props) {
        _Router_instances.add(this);
        _Router_containerSelector.set(this, void 0);
        _Router_routesMap.set(this, void 0);
        _Router_routePaths.set(this, void 0);
        _Router_errorBoundary.set(this, void 0);
        _Router_navigationId.set(this, 0);
        _Router_lastPath.set(this, void 0);
        _Router_notFoundRoute.set(this, void 0);
        _Router_unauthorizedRoute.set(this, void 0);
        _Router_navigationGuard.set(this, void 0);
        _Router_beforeUnloadHandler.set(this, void 0);
        _Router_routerReady.set(this, false);
        _Router_guardInFlight.set(this, false);
        if (!_a$1._runtimeInstance && routeRelativePaths) {
            __classPrivateFieldSet(this, _Router_containerSelector, props?.containerSelector ?? "#root", "f");
            __classPrivateFieldSet(this, _Router_errorBoundary, props?.enableErrorBoundary === false ? undefined : new ErrorBoundary({
                name: `router `
            }), "f");
            __classPrivateFieldSet(this, _Router_routesMap, new Map, "f");
            __classPrivateFieldSet(this, _Router_routePaths, [ "/", ...routeRelativePaths ], "f");
            _a$1._runtimeInstance = this;
            this._initialize(props?.notFoundRoute, props?.unauthorizedRoute);
            this._addPopStateEventListeners();
        }
        return _a$1._runtimeInstance;
    }
    async _initialize(notFoundRoute, unauthorizedRoute) {
        if (notFoundRoute) {
            const resolved = await notFoundRoute;
            resolved.containerSelector = __classPrivateFieldGet(this, _Router_containerSelector, "f");
            __classPrivateFieldSet(this, _Router_notFoundRoute, resolved, "f");
        } else {
            const defaultRoute = this._createDefaultNotFoundRoute();
            defaultRoute.containerSelector = __classPrivateFieldGet(this, _Router_containerSelector, "f");
            __classPrivateFieldSet(this, _Router_notFoundRoute, defaultRoute, "f");
        }
        if (unauthorizedRoute) {
            const resolved = await unauthorizedRoute;
            resolved.containerSelector = __classPrivateFieldGet(this, _Router_containerSelector, "f");
            __classPrivateFieldSet(this, _Router_unauthorizedRoute, resolved, "f");
        } else {
            const defaultRoute = this._createDefaultUnauthorizedRoute();
            defaultRoute.containerSelector = __classPrivateFieldGet(this, _Router_containerSelector, "f");
            __classPrivateFieldSet(this, _Router_unauthorizedRoute, defaultRoute, "f");
        }
        __classPrivateFieldSet(this, _Router_routerReady, true, "f");
        this._refreshCurrentPage();
    }
    _createDefaultNotFoundRoute() {
        let redirectTimer;
        const clearRedirectTimer = () => {
            if (redirectTimer) {
                clearTimeout(redirectTimer);
                redirectTimer = undefined;
            }
        };
        const route = new class NotFoundRoute extends Route {
            remove() {
                clearRedirectTimer();
                super.remove();
            }
        }({
            title: "Page Not Found",
            onRefreshHandler: () => {
                clearRedirectTimer();
                route.children = [ new Container([ new Text("404 - Page Not Found", {
                    type: "h1"
                }), new Text(`The path "${_a$1.location}" does not exist.`), new Text("You will be redirected to the home page in 8 seconds.") ], {
                    class: "not-found"
                }) ];
                redirectTimer = setTimeout(() => {
                    _a$1.navigateTo("/");
                }, 8e3);
            }
        });
        return route;
    }
    _createDefaultUnauthorizedRoute() {
        const route = new Route({
            title: "Access Denied",
            onRefreshHandler: () => {
                route.children = [ new Container([ new Text("403 - Access Denied", {
                    type: "h1"
                }), new Text("You do not have permission to access this application.") ], {
                    class: "unauthorized"
                }) ];
            }
        });
        return route;
    }
    [(_Router_containerSelector = new WeakMap, _Router_routesMap = new WeakMap, _Router_routePaths = new WeakMap, 
    _Router_errorBoundary = new WeakMap, _Router_navigationId = new WeakMap, _Router_lastPath = new WeakMap, 
    _Router_notFoundRoute = new WeakMap, _Router_unauthorizedRoute = new WeakMap, _Router_navigationGuard = new WeakMap, 
    _Router_beforeUnloadHandler = new WeakMap, _Router_routerReady = new WeakMap, _Router_guardInFlight = new WeakMap, 
    _Router_instances = new WeakSet, _Router_checkSingletonInstance = function _Router_checkSingletonInstance() {
        if (!_a$1._runtimeInstance) throw new SystemError(`InternalError`, `Router is not initialized. Router follows the singleton pattern. Please initialize the router with valid routes at the top of your application`);
    }, Symbol.toStringTag)]() {
        return "Router";
    }
    _resolveRouteAbsolutePath(path) {
        const localPath = path === "/" ? "" : path + "/";
        return resolvePath(`@/routes/${localPath}route.js`);
    }
    _addPopStateEventListeners() {
        window.addEventListener("popstate", async () => {
            if (!__classPrivateFieldGet(this, _Router_routerReady, "f")) return;
            if (!await this._checkNavigationGuard()) {
                const previousPath = __classPrivateFieldGet(this, _Router_lastPath, "f") ?? "/";
                const hashPath = `#/${previousPath === "/" ? "" : previousPath}`;
                history.pushState(null, "", hashPath);
                return;
            }
            this._refreshCurrentPage();
        });
    }
    _cleanup(outgoing) {
        if (outgoing?.isAlive) {
            outgoing.remove();
        }
        $(__classPrivateFieldGet(this, _Router_containerSelector, "f")).html(``);
        Toast.dismissAll();
    }
    async _refreshCurrentPage() {
        const queryParams = _a$1.queryParams;
        const queryObject = Object.fromEntries(queryParams.entries());
        this._navigateTo(_a$1.location, {
            query: queryObject
        }, true);
    }
    _addImportedRoute(path, route) {
        route.containerSelector = __classPrivateFieldGet(this, _Router_containerSelector, "f");
        route.class = `${path.replace("/", "-")}-route`;
        const cssLocalPath = path === "/" ? "" : path + "/";
        route.routeStylePath = resolvePath(`@/routes/${cssLocalPath}route.css`);
        __classPrivateFieldGet(this, _Router_routesMap, "f").set(path, route);
    }
    async _loadRoute(path) {
        if (__classPrivateFieldGet(this, _Router_routesMap, "f").has(path)) return __classPrivateFieldGet(this, _Router_routesMap, "f").get(path); else if (__classPrivateFieldGet(this, _Router_routePaths, "f").includes(path)) {
            let resolvedRouteFilePath = "";
            try {
                resolvedRouteFilePath = this._resolveRouteAbsolutePath(path);
                const module = await import(resolvedRouteFilePath);
                const route = await (module?.default);
                if (route && route instanceof Route) {
                    this._addImportedRoute(path, route);
                    return route;
                } else {
                    throw new SystemError("RouteExportError", `File ${resolvedRouteFilePath} was found, but Route needs to be exported as default.`);
                }
            } catch (error) {
                console.error(`Failed to load the route: ${path}, from the file ${resolvedRouteFilePath}`, error);
                throw error;
            }
        } else {
            if (__classPrivateFieldGet(this, _Router_notFoundRoute, "f")) return __classPrivateFieldGet(this, _Router_notFoundRoute, "f");
            throw new SystemError("RouteNotFoundError", `Path: ${path} is not defined on current Router object.`);
        }
    }
    _parseQueryParamsToString(obj = {}) {
        const entries = Object.entries(obj);
        if (entries.length === 0) return "";
        let queryString = "?";
        for (const [key, value] of entries) {
            queryString += `${key}=${value}&`;
        }
        return queryString;
    }
    async _navigateTo(path, options, replace = false) {
        var _b;
        if (_a$1.isExternalUrl(path)) {
            const isProtocolScheme = /^(mailto:|tel:)/.test(path);
            const openInNewTab = !isProtocolScheme && options?.newTab !== false;
            if (!openInNewTab) {
                if (!await this._checkNavigationGuard()) return;
            }
            if (openInNewTab) {
                window.open(path, "_blank");
            } else {
                window.location.href = path;
            }
            return;
        }
        const [browserUrl, internalUrl] = __classPrivateFieldGet(this, _Router_instances, "m", _Router_createUrls).call(this, path, options);
        if (options?.newTab) {
            window.open(browserUrl, "_blank");
            return;
        }
        if (!await this._checkNavigationGuard()) return;
        const navId = __classPrivateFieldSet(this, _Router_navigationId, (_b = __classPrivateFieldGet(this, _Router_navigationId, "f"), 
        ++_b), "f");
        const fromPath = __classPrivateFieldGet(this, _Router_lastPath, "f") ?? _a$1.location;
        if (replace) history.replaceState(null, "", browserUrl); else history.pushState(null, "", browserUrl);
        const newRoute = await this._loadRoute(internalUrl);
        if (navId !== __classPrivateFieldGet(this, _Router_navigationId, "f")) return;
        const oldRoute = __classPrivateFieldGet(this, _Router_routesMap, "f").get(fromPath);
        this._cleanup(oldRoute);
        this._applyRoute(newRoute);
        _a$1.clearNavigationGuard();
        __classPrivateFieldSet(this, _Router_lastPath, internalUrl, "f");
        new NavigationEvent(internalUrl, fromPath, options?.query).dispatch();
    }
    _applyRoute(route) {
        try {
            document.title = route.title;
            route.render();
        } catch (error) {
            if (error instanceof SystemError) throw error;
            console.error("[Router._applyRoute] route render failed", {
                path: _a$1.location,
                error: error
            });
            throw new SystemError(`RouteError`, `Error loading route on ${_a$1.location}.`, {
                cause: error
            });
        }
    }
    _popLevel(x = 1) {
        const path = _a$1.location.split("/");
        if (path.length <= 1) return this._navigateTo("/");
        const sliced = path.slice(0, path.length - x).join("/");
        this._navigateTo(sliced || "/");
    }
    async _checkNavigationGuard() {
        if (!__classPrivateFieldGet(this, _Router_navigationGuard, "f")) return true;
        if (__classPrivateFieldGet(this, _Router_guardInFlight, "f")) return false;
        const guardResult = __classPrivateFieldGet(this, _Router_navigationGuard, "f").call(this);
        if (guardResult === false) return false;
        if (typeof guardResult === "string") {
            __classPrivateFieldSet(this, _Router_guardInFlight, true, "f");
            try {
                return await this._showNavigationGuardDialog(guardResult);
            } finally {
                __classPrivateFieldSet(this, _Router_guardInFlight, false, "f");
            }
        }
        return true;
    }
    _showNavigationGuardDialog(message) {
        return new Promise(resolve => {
            let settled = false;
            const settle = allow => {
                if (settled) return;
                settled = true;
                resolve(allow);
            };
            const dialog = new Dialog({
                title: "Unsaved Changes",
                variant: "warning",
                content: new Text(message),
                backdrop: true,
                closeOnFocusLoss: false,
                containerSelector: "body",
                onCloseHandler: () => {
                    settle(false);
                    dialog.remove();
                },
                footer: new Container([ new Button("Stay", {
                    variant: "secondary",
                    onClickHandler: () => {
                        dialog.close();
                    }
                }), new Button("Leave", {
                    variant: "danger",
                    onClickHandler: () => {
                        settle(true);
                        dialog.close();
                    }
                }) ])
            });
            dialog.render();
            dialog.open();
        });
    }
}

_a$1 = Router, _Router_createUrls = function _Router_createUrls(path, options) {
    const basePath = options?.newTab ? _a$1.pageRootPath : "";
    const queryParams = this._parseQueryParamsToString(options?.query);
    let routePath = /^\.\//.test(path) ? `${_a$1.location === "/" ? "" : _a$1.location + "/"}${path.substring(2)}` : path;
    if (routePath !== "/" && routePath.startsWith("/")) {
        routePath = routePath.substring(1);
    }
    const hashPath = `#/${routePath === "/" ? "" : routePath}`;
    return [ basePath + queryParams + hashPath, routePath ];
};

class LinkButton extends Button {
    constructor(children, path, props) {
        const isExternal = Router.isExternalUrl(path);
        super(children, {
            ...props,
            onClickHandler: isExternal ? e => {
                props?.onClickHandler?.(e);
            } : e => {
                Router.navigateTo(path, props?.navigationOptions);
                props?.onClickHandler?.(e);
            }
        });
        this._path = path;
        this._isExternal = isExternal;
        this._disableOnOwnPath = isExternal ? false : props?.disableOnOwnPath ?? true;
        this._target = isExternal ? props?.target ?? "_blank" : undefined;
        if (this._disableOnOwnPath && Router.location === path) {
            this._isDisabled = true;
        }
    }
    _onNavigationHandler() {
        if (!this._disableOnOwnPath) return;
        this._cleanupEventListener?.();
        this._cleanupEventListener = NavigationEvent.listener(e => {
            this.isDisabled = e?.to === this._path;
        });
    }
    remove() {
        this._cleanupEventListener?.();
        this._cleanupEventListener = undefined;
        super.remove();
    }
    _applyEventListeners() {
        super._applyEventListeners();
        this._onNavigationHandler();
    }
    toString() {
        if (!this._isExternal) return super.toString();
        return `<a href="${escapeAttr(this._path)}"\n\t\t\t\t\ttarget="${this._target}"\n\t\t\t\t\trel="noopener noreferrer"\n\t\t\t\t\ttitle="${escapeAttr(this.title)}"\n\t\t\t\t\tid="${this.id}"\n\t\t\t\t\tclass="${this.class} ${this.modifierClasses}"\n\t\t\t\t\t${this.isDisabled || this.isLoading ? 'aria-disabled="true" tabindex="-1"' : ""}\n\t\t\t\t></a>`;
    }
    get isExternal() {
        return this._isExternal;
    }
    get path() {
        return this._path;
    }
}

async function pageReset({clearConsole: clearConsole = true, removeStyles: removeStyles = true, themePath: themePath, __INTERNAL_DEBUG_OPTIONS: __INTERNAL_DEBUG_OPTIONS} = {
    clearConsole: true,
    removeStyles: true
}) {
    if (clearConsole) window.console.clear();
    const resetClass = `${LIB_PREFIX}-reset`;
    let inheritedStyles = [];
    if (removeStyles) {
        const s1 = $(`link[rel="stylesheet"]`), s2 = $(`style`);
        inheritedStyles.push(...s1.toArray());
        inheritedStyles.push(...s2.toArray());
        s1.remove();
        s2.remove();
    }
    const existingRoot = document.getElementById("root");
    const rootEl = existingRoot ?? document.createElement("div");
    if (!existingRoot) {
        rootEl.id = "root";
        $("body").prepend(rootEl);
    }
    $("body").addClass(resetClass);
    const styleEl = document.createElement("style");
    styleEl.textContent = `\n      .${resetClass}{\n        overflow:hidden;\n        padding:0;\n      }\n      .${resetClass}>*{\n        display: none;\n      }\n      #root{\n        display: block;\n        width: 100vw;\n        height: 100svh;\n        margin:0;\n        padding:0;\n        background-color:transparent;\n      }\n    `;
    document.head.appendChild(styleEl);
    const loadPromises = [];
    let baseStyle = null;
    if (!__INTERNAL_DEBUG_OPTIONS?.stopAutoLoadBaseTheme) {
        const baseCssPath = resolvePath(`@/libs/${LIB_PREFIX}/${LIB_PREFIX}.base.css`);
        baseStyle = new StyleResource(baseCssPath);
        loadPromises.push(baseStyle.ready);
    }
    let appTheme = null;
    if (themePath) {
        appTheme = new StyleResource(themePath);
        loadPromises.push(appTheme.ready);
    }
    const cssResults = await Promise.allSettled(loadPromises);
    for (const result of cssResults) {
        if (result.status === "rejected") {
            console.error("[pageReset] a stylesheet failed to load", result.reason);
        }
    }
    window.displaySharePointUI = () => {
        if (rootEl.isConnected) rootEl.remove();
        if (styleEl.isConnected) styleEl.remove();
        baseStyle?.remove();
        appTheme?.remove();
        forEach(inheritedStyles, tag => $("head").append(tag));
        $("body").removeClass(resetClass);
    };
    if (typeof _spPageContextInfo !== "undefined" && !__INTERNAL_DEBUG_OPTIONS?.stopAutoRefreshDigest) {
        startDigestTimer();
    }
}

class SimpleElapsedTimeBenchmark {
    constructor() {
        this._start = 0;
        this._end = 0;
        this._elapsed = -1;
    }
    start() {
        this._start = (new Date).getTime();
    }
    _calcElapsedTime() {
        this._elapsed = this._end - this._start;
    }
    stop() {
        this._end = (new Date).getTime();
        this._calcElapsedTime();
    }
    get elapsed() {
        if (this._elapsed === -1) console.warn("Elapsed Time Benchmark util was not started");
        return this._elapsed;
    }
}

async function defineRoute(closureCallback) {
    const route = new Route;
    const cleanups = [];
    function runAndClearCleanups() {
        const pending = cleanups.splice(0);
        for (const fn of pending) {
            try {
                fn();
            } catch (err) {
                console.error("[defineRoute.onCleanup] cleanup threw", err);
            }
        }
    }
    const config = {
        setRouteTitle: title => {
            route.title = title;
        },
        onCleanup: fn => {
            cleanups.push(fn);
        },
        $DANGEROUS__route_backdoor: route
    };
    const refreshHandler = async () => {
        runAndClearCleanups();
        route.children = await closureCallback(config);
    };
    route.onRefreshHandler = async () => await refreshHandler();
    route.registerCleanupRunner(runAndClearCleanups);
    return route;
}

const MAX_RECIPIENTS_PER_CALL = 50;

const _webUrl = () => (_spPageContextInfo?.webAbsoluteUrl ?? location.origin).replace(/\/$/, "");

function _rethrow(name, message, cause, details) {
    console.error(`[email.api._rethrow] ${name}: ${message}`, {
        cause: cause,
        details: details
    });
    if (cause instanceof SystemError) throw cause;
    const err = new SystemError(name, message, {
        breaksFlow: false,
        cause: cause
    });
    err.details = details ?? null;
    throw err;
}

async function _ensureUserSafe(loginNameOrEmail) {
    try {
        const url = `${_webUrl()}/_api/web/ensureUser`;
        const result = await spPOST(url, {
            data: {
                logonName: loginNameOrEmail
            }
        });
        if (!result || typeof result !== "object") return null;
        const obj = result;
        const user = "d" in obj ? obj.d : obj;
        return user ?? null;
    } catch (err) {
        console.warn("[email.api._ensureUserSafe] ensureUser failed, recipient will remain unresolved", {
            login: loginNameOrEmail,
            err: err
        });
        return null;
    }
}

async function resolveEmailsToLogins(emails) {
    const cleaned = [ ...new Set((emails ?? []).map(normalizeEmail).filter(Boolean)) ];
    const valid = cleaned.filter(isValidEmail);
    const invalid = cleaned.filter(e => !isValidEmail(e));
    const resolved = new Map;
    if (!valid.length) return {
        resolved: resolved,
        unresolved: [],
        invalid: invalid
    };
    const filter = valid.map(e => `Email eq '${escapeODataStr(e)}'`).join(" or ");
    const url = `${_webUrl()}/_api/web/siteUsers` + `?$filter=${encodeURIComponent(filter)}` + `&$select=Email,LoginName` + `&$top=${valid.length}`;
    let data;
    try {
        data = await spGET(url);
    } catch (cause) {
        _rethrow("EmailResolutionFailed", `Failed to resolve ${valid.length} email(s) to login names via siteUsers query.`, cause, {
            count: valid.length
        });
    }
    const rows = unwrapCollection(data);
    for (const r of rows) {
        const e = normalizeEmail(r.Email);
        if (e && r.LoginName) resolved.set(e, r.LoginName);
    }
    const unresolved = valid.filter(e => !resolved.has(e));
    return {
        resolved: resolved,
        unresolved: unresolved,
        invalid: invalid
    };
}

async function sendEmail({to: to, cc: cc, bcc: bcc, subject: subject, body: body, from: from}) {
    if (!subject || typeof subject !== "string") {
        throw new SystemError("EmailValidation", "sendEmail: `subject` is required and must be a non-empty string.");
    }
    if (!body || typeof body !== "string") {
        throw new SystemError("EmailValidation", "sendEmail: `body` is required and must be a non-empty string.");
    }
    const toList = [].concat(to ?? []).map(normalizeEmail).filter(Boolean);
    const ccList = [].concat(cc ?? []).map(normalizeEmail).filter(Boolean);
    const bccList = [].concat(bcc ?? []).map(normalizeEmail).filter(Boolean);
    const allDedup = [ ...new Set([ ...toList, ...ccList, ...bccList ]) ];
    if (!allDedup.length) {
        throw new SystemError("EmailValidation", "sendEmail: at least one recipient is required.");
    }
    if (allDedup.length > MAX_RECIPIENTS_PER_CALL) {
        const err = new SystemError("EmailTooManyRecipients", `sendEmail: recipient count ${allDedup.length} exceeds max ${MAX_RECIPIENTS_PER_CALL}. ` + `Split into batches of <= ${MAX_RECIPIENTS_PER_CALL} and call sendEmail once per batch.`, {
            breaksFlow: false
        });
        err.details = {
            count: allDedup.length,
            max: MAX_RECIPIENTS_PER_CALL
        };
        throw err;
    }
    let resolution;
    try {
        resolution = await resolveEmailsToLogins(allDedup);
    } catch (cause) {
        _rethrow("EmailResolutionFailed", "sendEmail: unable to resolve recipient emails to claim logins.", cause, {
            recipientCount: allDedup.length
        });
    }
    if (resolution.invalid.length) {
        const err = new SystemError("EmailInvalid", `sendEmail: malformed email address(es): ${resolution.invalid.join(", ")}`, {
            breaksFlow: false
        });
        err.details = {
            invalid: resolution.invalid
        };
        throw err;
    }
    if (resolution.unresolved.length) {
        const stillMissing = [];
        for (const email of resolution.unresolved) {
            const user = await _ensureUserSafe(email);
            if (user?.LoginName) {
                resolution.resolved.set(email, user.LoginName);
            } else {
                stillMissing.push(email);
            }
        }
        resolution.unresolved = stillMissing;
    }
    if (resolution.unresolved.length) {
        const err = new SystemError("EmailUnresolved", `sendEmail: ${resolution.unresolved.length} recipient(s) could not be resolved ` + `even after ensureUser fallback: ${resolution.unresolved.join(", ")}. Each user must have visited or been granted ` + `access to this site collection before they can receive mail from it.`, {
            breaksFlow: false
        });
        err.details = {
            unresolved: resolution.unresolved
        };
        throw err;
    }
    const _mapToLogins = list => list.map(e => resolution.resolved.get(e)).filter(v => v !== undefined);
    const properties = {
        __metadata: {
            type: "SP.Utilities.EmailProperties"
        },
        To: {
            results: _mapToLogins(toList)
        },
        Subject: subject,
        Body: body
    };
    if (ccList.length) properties.Cc = {
        results: _mapToLogins(ccList)
    };
    if (bccList.length) properties.Bcc = {
        results: _mapToLogins(bccList)
    };
    if (from) properties.From = from;
    const toResults = properties.To.results;
    if (!toResults.length) {
        const fallback = _mapToLogins(bccList)[0] ?? _mapToLogins(ccList)[0] ?? from;
        if (!fallback) {
            throw new SystemError("EmailValidation", "sendEmail: no resolvable To recipient available.");
        }
        properties.To = {
            results: [ fallback ]
        };
    }
    const url = `${_webUrl()}/_api/SP.Utilities.Utility.SendEmail`;
    try {
        await spPOST(url, {
            data: {
                properties: properties
            }
        });
    } catch (cause) {
        _rethrow("EmailSendFailed", `sendEmail: SP.Utilities.Utility.SendEmail rejected the request -- ` + `${cause?.message ?? "(no message)"}`, cause, {
            recipientCount: allDedup.length
        });
    }
    return {
        ok: true,
        recipientCount: allDedup.length
    };
}

var _a, _ContextStore_store, _ContextStore_isExpired, _ContextStore_tryDispose;

class ContextStore {
    constructor() {}
    static set(key, value, ttlMs) {
        const existing = __classPrivateFieldGet(_a, _a, "f", _ContextStore_store).get(key);
        if (existing !== undefined) __classPrivateFieldGet(_a, _a, "m", _ContextStore_tryDispose).call(_a, existing.value);
        __classPrivateFieldGet(_a, _a, "f", _ContextStore_store).set(key, {
            value: value,
            createdAt: Date.now(),
            expiresAt: ttlMs !== undefined ? Date.now() + ttlMs : undefined
        });
    }
    static get(key, fallback) {
        const entry = __classPrivateFieldGet(_a, _a, "f", _ContextStore_store).get(key);
        if (entry === undefined) {
            if (arguments.length >= 2) return fallback;
            throw new SystemError("ContextStore", `Key "${key}" not found in ContextStore`);
        }
        if (__classPrivateFieldGet(_a, _a, "m", _ContextStore_isExpired).call(_a, entry)) {
            __classPrivateFieldGet(_a, _a, "m", _ContextStore_tryDispose).call(_a, entry.value);
            __classPrivateFieldGet(_a, _a, "f", _ContextStore_store).delete(key);
            if (arguments.length >= 2) return fallback;
            throw new SystemError("ContextStore", `Key "${key}" not found in ContextStore`);
        }
        return entry.value;
    }
    static has(key) {
        const entry = __classPrivateFieldGet(_a, _a, "f", _ContextStore_store).get(key);
        if (entry === undefined) return false;
        if (__classPrivateFieldGet(_a, _a, "m", _ContextStore_isExpired).call(_a, entry)) {
            __classPrivateFieldGet(_a, _a, "m", _ContextStore_tryDispose).call(_a, entry.value);
            __classPrivateFieldGet(_a, _a, "f", _ContextStore_store).delete(key);
            return false;
        }
        return true;
    }
    static delete(key) {
        const entry = __classPrivateFieldGet(_a, _a, "f", _ContextStore_store).get(key);
        if (entry) __classPrivateFieldGet(_a, _a, "m", _ContextStore_tryDispose).call(_a, entry.value);
        return __classPrivateFieldGet(_a, _a, "f", _ContextStore_store).delete(key);
    }
    static clear() {
        for (const entry of __classPrivateFieldGet(_a, _a, "f", _ContextStore_store).values()) {
            __classPrivateFieldGet(_a, _a, "m", _ContextStore_tryDispose).call(_a, entry.value);
        }
        __classPrivateFieldGet(_a, _a, "f", _ContextStore_store).clear();
    }
    static clearScope(prefix) {
        let count = 0;
        for (const [key, entry] of __classPrivateFieldGet(_a, _a, "f", _ContextStore_store)) {
            if (key.startsWith(prefix)) {
                __classPrivateFieldGet(_a, _a, "m", _ContextStore_tryDispose).call(_a, entry.value);
                __classPrivateFieldGet(_a, _a, "f", _ContextStore_store).delete(key);
                count++;
            }
        }
        return count;
    }
    static get size() {
        return __classPrivateFieldGet(_a, _a, "f", _ContextStore_store).size;
    }
    static keys() {
        return Array.from(__classPrivateFieldGet(_a, _a, "f", _ContextStore_store).keys());
    }
}

_a = ContextStore, _ContextStore_isExpired = function _ContextStore_isExpired(entry) {
    return entry.expiresAt !== undefined && Date.now() > entry.expiresAt;
}, _ContextStore_tryDispose = function _ContextStore_tryDispose(value) {
    if (value && typeof value === "object" && "dispose" in value && typeof value.dispose === "function") {
        value.dispose();
    }
};

_ContextStore_store = {
    value: new Map
};

class FormSchema {
    constructor(fields) {
        this._fields = fields;
    }
    static fromKeys(fieldNames) {
        const fields = Object.fromEntries(fieldNames.map(name => [ name, new FormField ]));
        return new FormSchema(fields);
    }
    validateAll() {
        let allValid = true;
        for (const field of Object.values(this._fields)) {
            if (field.validate() === false) allValid = false;
        }
        return allValid;
    }
    async validateAllAsync() {
        const fields = Object.values(this._fields);
        const results = await Promise.all(fields.map(field => field.validateAsync()));
        return results.every(r => r !== false);
    }
    get isValid() {
        return this.validateAll();
    }
    get isValidating() {
        return Object.values(this._fields).some(f => f.isValidating);
    }
    get hasUntouchedFields() {
        return Object.values(this._fields).some(e => !e.wasTouched);
    }
    get isDirty() {
        return Object.values(this._fields).some(e => e.wasTouched);
    }
    focusOnFirstInvalid() {
        this.validateAll();
        Object.values(this._fields).find(e => !e.isValid)?.focusOnInput();
    }
    get(key) {
        return this._fields[key];
    }
    parse() {
        const obj = {};
        for (const key in this._fields) {
            obj[key] = this._fields[key].value;
        }
        return obj;
    }
    parseForList() {
        const obj = {};
        for (const key in this._fields) {
            obj[key] = extractComboBoxValue(this._fields[key].value);
        }
        return obj;
    }
}

function enforceStrictObject(obj) {
    return new Proxy(obj, {
        get(target, prop) {
            if (!(prop in target)) {
                throw new SystemError("TypeError", `Property '${String(prop)}' does not exist in object`);
            }
            return target[prop];
        }
    });
}

function isCallable(arg) {
    return typeof arg === "function" || arg !== null && typeof arg === "object" && "call" in arg;
}

class TabGroup extends Container {
    constructor(tabs, props = {}) {
        super([], props);
        this._tabs = tabs;
        this._onTabChangeHandler = props?.onTabChangeHandler ?? (() => ({}));
        const viewEntries = tabs.map(tab => [ tab.key, tab.view ]);
        this._viewSwitcher = new ViewSwitcher(viewEntries, {
            selectedViewName: props?.selectedTabKey,
            onRefreshHandler: (key, index, view) => {
                this._updateActiveTab(key);
                this._onTabChangeHandler({
                    view: view,
                    key: key,
                    label: tabs[index].label,
                    disabled: tabs[index].disabled
                });
            }
        });
        this.children = [ this._viewSwitcher ];
    }
    get [Symbol.toStringTag]() {
        return "Tab Group";
    }
    _createTabButton(tab, index) {
        const isActive = this._viewSwitcher.currentViewName === tab.key;
        const disabledClass = tab.disabled ? `${this.topClassBEM}__nav__tab-btn--disabled` : "";
        const activeClass = isActive ? `${this.topClassBEM}__nav__tab-btn--active` : "";
        return `\n      <button\n        class="${this.topClassBEM}__nav__tab-btn ${activeClass} ${disabledClass}"\n        data-tab-key="${escapeAttr(tab.key)}"\n        data-tab-index="${index}"\n        ${tab.disabled ? "disabled" : ""}\n        role="tab"\n        aria-selected="${isActive}"\n        tabindex="${isActive ? "0" : "-1"}"\n      >\n        ${escapeHtml(tab.label)}\n      </button>\n    `;
    }
    _createTabNavigation() {
        const tabButtons = this._tabs.map((tab, index) => this._createTabButton(tab, index)).join("");
        return `\n      <div class="${this.topClassBEM}__nav" role="tablist">\n        ${tabButtons}\n      </div>\n    `;
    }
    toString() {
        return `\n      <div\n        id="${this.id}"\n        class="${this.class}"\n      >\n        ${this._createTabNavigation()}\n        <div class="${this.topClassBEM}__content"></div>\n      </div>\n    `;
    }
    render() {
        super.render(true, {
            childrenContainerSelector: `.${this.topClassBEM}__content`
        });
    }
    _updateActiveTab(newKey) {
        this.instance?.find(`.${this.topClassBEM}__nav__tab-btn`).each((_, tab) => {
            $(tab).removeClass(`${this.topClassBEM}__nav__tab-btn--active`);
            $(tab).attr("aria-selected", "false");
            $(tab).attr("tabindex", "-1");
        });
        const activeTab = this.instance?.find(`[data-tab-key="${newKey}"]`);
        activeTab?.addClass(`${this.topClassBEM}__nav__tab-btn--active`);
        activeTab?.attr("aria-selected", "true");
        activeTab?.attr("tabindex", "0");
    }
    _applyEventListeners() {
        super._applyEventListeners();
        this._onTabClickListeners();
    }
    _onTabClickListeners() {
        this._addManagedListener("click", e => {
            const btn = $(e.currentTarget);
            if (btn.attr("disabled") !== undefined) return;
            const tabKey = btn.attr("data-tab-key");
            if (tabKey) this.setTab(tabKey);
        }, `.${this.topClassBEM}__nav__tab-btn`);
    }
    setTab(tabKey) {
        this._viewSwitcher.setView(tabKey);
    }
    setTabByIndex(index) {
        if (index < 0 || index >= this._tabs.length) return;
        this.setTab(this._tabs[index].key);
    }
    nextTab() {
        this._viewSwitcher.next();
    }
    previousTab() {
        this._viewSwitcher.previous();
    }
    addTabs(...tabs) {
        this._tabs = [ ...this._tabs, ...tabs ];
        const viewEntries = tabs.map(tab => [ tab.key, tab.view ]);
        this._viewSwitcher.addViews(...viewEntries);
    }
    get currentTab() {
        return this._viewSwitcher.currentViewName;
    }
    get currentTabIndex() {
        return this._viewSwitcher.currentViewIndex;
    }
    get currentView() {
        return this._viewSwitcher.currentChild;
    }
}

function isLabelTargetProvider(component) {
    return component != null && typeof component.labelTarget === "string";
}

class FieldLabel extends HTMDElement {
    constructor(labelText, component, props) {
        super(component, props);
        this._labelText = labelText;
        if (isLabelTargetProvider(component)) {
            this._position = props?.position ?? component.defaultLabelPosition ?? "top";
            this._componentId = component.labelTarget;
        } else {
            this._position = props?.position ?? "top";
            this._componentId = component.id;
        }
        this._tooltip = props?.tooltip;
    }
    get [Symbol.toStringTag]() {
        return "Field Label";
    }
    get modifierClasses() {
        return `${this.topClassBEM}--${this._position}`;
    }
    _createLabel() {
        const tooltipAttr = this._tooltip ? `title="${escapeAttr(this._tooltip)}"` : "";
        const tooltipIcon = this._tooltip ? `<span class="${this.topClassBEM}__tooltip-icon" aria-label="More information">${getIcon("information-line")}</span>` : "";
        return `\n      <label\n        class="${this.topClassBEM}__label"\n        for="${this._componentId}"\n        ${tooltipAttr}\n      >\n        <span class="${this.topClassBEM}__label-text">${escapeHtml(this._labelText)}</span>\n        ${tooltipIcon}\n      </label>\n    `;
    }
    toString() {
        return `\n      <div\n        id="${this.id}"\n        class="${this.class} ${this.modifierClasses}"\n      >\n        <div class="${this.topClassBEM}__wrapper">\n          ${this._createLabel()}\n          <div class="${this.topClassBEM}__component-container"></div>\n         </div>\n      </div>\n    `;
    }
    render() {
        super.render(true, {
            childrenContainerSelector: `.${this.topClassBEM}__component-container`
        });
    }
    set label(text) {
        this._labelText = text;
        this.instance?.find(`.${this.topClassBEM}__label-text`)?.text(text);
    }
    set tooltip(tooltip) {
        this._tooltip = tooltip;
        this.instance?.find(`.${this.topClassBEM}__label`).replaceWith(this._createLabel());
    }
    set position(position) {
        if (this._position === position) return;
        this._position = position;
        this.render();
    }
    get label() {
        return this._labelText;
    }
    get position() {
        return this._position;
    }
    get tooltip() {
        return this._tooltip;
    }
}

function isHTMDNode(arg) {
    if (!Array.isArray(arg)) {
        return isHTMDComponent(arg) || typeof arg === "number" || typeof arg === "string" || typeof arg === `function` && isHTMDNode(arg());
    } else return every(arg, isHTMDNode);
}

export { AccordionGroup, AccordionItem, Button, Card, CheckBox, ComboBox, Container, ContextStore, CurrentUser, DateInput, DateRangeInput, DebouncedInput, Dialog, ErrorBoundary, FORMAT_MAP, FieldLabel, FormControl, FormField, FormSchema, Fragment, HTMDElement, Image, LinkButton, List, Loader, MAX_RECIPIENTS_PER_CALL, Modal, NavigationEvent, NumberInput, PeoplePicker, Router, SP_ACCEPT_MINIMAL, SidePanel, SimpleElapsedTimeBenchmark, SiteApi, StyleResource, SystemError, TabGroup, Text, TextArea, TextInput, Toast, UserIdentity, View, ViewSwitcher, dayjs as __dayjs, Fuse as __fuse, copyToClipboard, defineRoute, enforceStrictObject, escapeAttr, escapeHtml, extractComboBoxValue, fromFieldValue, generateRuntimeUID, generateUUIDv4, getFullUserDetails, getIcon, getUserProfile, isCallable, isComboBoxOption, isHTMDComponent, isHTMDNode, listIcons, pageReset, parseEmployeeId, refreshRequestDigest, registerIcons, resolveEmailsToLogins, resolvePath, runtimeEventName, sanitizeQuery, searchUsers, sendEmail, spDELETE, spGET, spMERGE, spPOST, startDigestTimer, stopDigestTimer, toFieldValue };
//# sourceMappingURL=nofbiz.base.js.map
