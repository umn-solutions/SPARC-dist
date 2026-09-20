import * as lodashEs from 'lodash-es';
export { lodashEs as __lodash };
export { z as __zod } from 'zod';
import dayjs from 'dayjs/esm/index.js';
export { default as __dayjs } from 'dayjs/esm/index.js';
export { default as __fuse } from 'fuse.js';
import { v4 } from 'uuid';

/** Accepted dataset formats: raw strings or structured option objects. */
type ComboBoxDataset = string[] | ComboBoxOptionProps[];
/** Represents an option of a ComboBox dataset. */
interface ComboBoxOptionProps {
    /** Text to be displayed */
    label: string;
    /** Actual option value */
    value: string | object;
    /** Indicates whether the option is selectable */
    disabled?: boolean;
    checked?: boolean;
}
interface ComboBoxProps extends FormControlProps {
    /** Allows the user to select multiple options. @default false */
    allowMultiple?: boolean;
    /** Placeholder text for the input field. @default "Select..." */
    placeholder?: string;
    /** If filtering is enabled, this is used for the clear button's text. @default "Clear..." */
    clearText?: string;
    /** Indicates if dataset is filterable. @default true */
    allowFiltering?: boolean;
    /** Callback that receives the current selection each time an option is toggled. */
    onSelectHandler?: (selection: ComboBoxOptionProps | ComboBoxOptionProps[]) => void;
    /** When true the full options array is returned (with checked flags), not only checked items. @default false */
    returnFullDataset?: boolean;
    /** When true, allows the user to create new options by typing text that doesn't match existing options. @default false */
    allowCreate?: boolean;
    /**
     * When provided, this replaces the default Fuse.js filter. May return a Promise for async filtering.
     * @param search The current string input from the searchbar.
     * @returns Filtered array of options, or a Promise resolving to one.
     */
    filteringFunction?: (search: string) => ComboBoxOptionProps[] | Promise<ComboBoxOptionProps[]>;
    /** Text shown in the dropdown while an async filter is running. @default "Searching..." */
    loadingText?: string;
    /** Text shown in the dropdown when no results match. @default "No results found" */
    noResultsText?: string;
    /** Text shown in the dropdown when an async filter throws. @default "Search failed" */
    errorText?: string;
}
declare class ComboBox extends FormControl<ComboBoxOptionProps | ComboBoxOptionProps[]> {
    protected _dataset: ComboBoxOptionProps[];
    protected _filteredDataset: ComboBoxOptionProps[];
    private _allowMultiple;
    private _placeholder;
    private _onSelectHandler?;
    private _clearText;
    private _isDropdownOpen;
    private _allowFiltering;
    private _filterFn;
    private _returnFullDataset;
    private _explicitlyDisabled;
    private _fuseInstance;
    private _allowCreate;
    private _focusedIndex;
    private _pendingTimeouts;
    protected _isLoading: boolean;
    protected _hasError: boolean;
    protected _searchSeq: number;
    private _loadingText;
    private _noResultsText;
    private _errorText;
    constructor(field: FormField<ComboBoxOptionProps | ComboBoxOptionProps[]>, dataset: ComboBoxDataset, props?: ComboBoxProps);
    private _normalizeDataset;
    private _getFuseInstance;
    private _invalidateFuseCache;
    private _defaultFilteringFunction;
    private _disableOnEmptyDataset;
    private _syncDatasetFromField;
    private _trackTimeout;
    private _clearAllTimeouts;
    private _createSearchBar;
    private _createDropdown;
    private _createOption;
    private _createOptionsList;
    private _createCreateOption;
    /** Builds the inner content of the dropdown list panel. */
    protected _createDropdownBody(): string;
    /** Returns the empty-state message string (HTML-safe). PeoplePicker overrides for context-aware hints. */
    protected _emptyMessage(): string;
    /**
     * Sets the async-loading state and updates the dropdown body.
     * Idempotent -- calling with the same value is a no-op.
     * Does NOT touch `form-control--loading`; the input stays typable.
     */
    protected _setLoading(loading: boolean): void;
    protected _refreshDropdownList(): void;
    private _updateCreateOption;
    private _refreshChevron;
    private _displaySelection;
    private _selectOption;
    private _createNewOption;
    private _afterSelection;
    private _updateOptionSelectedStates;
    protected _onSelectHandlerProxy(): void;
    private _onResetFilteredDataSearch;
    private _openDropdown;
    private _closeDropdown;
    private _bindKeyboardNavigation;
    private _moveFocus;
    private _selectFocusedOption;
    private _bindDropdownMousedownHandler;
    private _bindOptionClickHandlers;
    private _bindSearchBarEventHandlers;
    protected _onSearchEventListeners(): void;
    private _bindBlurHandler;
    private _bindClearIconHandler;
    private _bindCreateOptionHandler;
    private _bindClearButtonHandler;
    protected _applyEventListeners(): void;
    clearSelection(): void;
    get modifierClasses(): string;
    toString(): string;
    get dataset(): ComboBoxOptionProps[];
    set dataset(data: ComboBoxDataset);
    set filteringFunction(callback: (search: string) => ComboBoxOptionProps[] | Promise<ComboBoxOptionProps[]>);
    render(): void;
    remove(): void;
}

type FormFieldType = string | number | boolean | ComboBoxOptionProps | ComboBoxOptionProps[];
type Unsubscribe = () => void;
interface FormFieldProps<T extends FormFieldType> {
    value: T;
    validatorCallback?: (v: T) => boolean | Promise<boolean>;
}
declare class FormField<T extends FormFieldType> {
    private _value;
    private _inputSelector?;
    private _validatorCallback?;
    private _subscribers;
    private _isValid;
    private _isValidating;
    private _wasTouched;
    private _isDisposed;
    constructor(props?: FormFieldProps<T>);
    [Symbol.toStringTag](): string;
    [Symbol.toPrimitive](): string | T;
    toString(): string | T;
    validate(): boolean | null;
    validateAsync(): Promise<boolean | null>;
    focusOnInput(): void;
    set value(data: T);
    set inputSelector(selector: string);
    get value(): T;
    get wasTouched(): boolean;
    get isValid(): boolean;
    get isValidating(): boolean;
    get hasValidation(): boolean;
    get isDisposed(): boolean;
    subscribe(callback: (v: T) => void): Unsubscribe;
    private _notify;
    dispose(): void;
}

/**
 * ALL HTMD Element MUST implement these methods
 */
interface HTMDElementInterface {
    /**
     * Discriminator to identify classes that implement this interface
     * @see isHTMDComponent
     */
    isHTMD: true;
    /**
     * A string representation used to render the actual element into the DOM
     */
    toString(): string;
    /**
     * Method used to render the actual element and apply the necessary event handlers
     */
    render: () => void;
    /**
     * Completely removes the element from the DOM
     */
    remove: () => void;
    /**
     * A css selector to specify where the element should be rendered
     * When nesting elements, the parent should be responsible for assigning the
     * containerSelector on its children
     */
    containerSelector?: string;
}

/**
 * A node represents a type that can be rendered to the DOM directly or via the HTMDElementInterface.render() method.
 * @see HTMDElementInterface
 */
type HTMDSingleNode = HTMDElementInterface | string | number;
/**
 * Represents a single node, collection of nodes, or a function that returns a single node.
 * Wrapping a node on an anonymous function is useful for updating text on components.
 * @example
 * const text = new Text([()=>user.name, `\`s Dashboard`], { type: 'h1' });
 * //perform some logic that changes the user.name
 * text.refresh() // recalls the function and successfully updates the first child
 * //whitout the function , the actual value of user.name is passed, instead of a ref to user.name
 */
type HTMDNode = HTMDSingleNode | (() => HTMDNode) | Array<HTMDNode | (() => HTMDNode)>;

/**
 * Universally Unique Identifier - Use this type just to provide more clarity. UUID should never be an empty string
 */
type UUID = string;

interface HTMDElementProps {
    /** if a value is provided, sparc will not use automatic UUID generation! */
    id?: UUID;
    /** Regular HTML class names */
    class?: string;
    /** Valid CSS selector targeting the current element's parent.
     * @example
     *
     * const myElement = new Element({...,containerSelector:"#login-form",...})
     * myElement.render() //my element will be appended to #login-form
     */
    containerSelector?: string;
}
interface ChildrenOptions {
    childrenContainerSelector?: string;
}
/**
 * Abstract base class for rendering structured HTML elements with
 * unique IDs, BEM-based class names, event management, and child support.
 */
declare abstract class HTMDElement implements HTMDElementInterface {
    isHTMD: true;
    private _id;
    private _class;
    /** Contains the lowercase class name. Used in to generate default class names and to classify the element type*/
    private _name;
    /**
     * string|undefined
     * ---
     * should be ...but for the sake of simplicity, when undefined ill assign an empty string
     * Pardon me for the incoherence and read the HTMDElementInterface docs on the same property
     */
    protected _containerSelector: string;
    protected _children?: HTMDNode;
    constructor(children?: HTMDNode, props?: HTMDElementProps);
    get [Symbol.toStringTag](): string;
    private _eventsMap;
    /**
     * Registers an event handler for a given event type on this element.
     * Replaces any previously assigned handler for the same event.
     * @param eventName The DOM event type to listen for (e.g., 'click').
     * @param callback The event handler function.
     */
    setEventHandler<K extends keyof HTMLElementEventMap>(eventName: K, callback?: (ev: HTMLElementEventMap[K]) => void): void;
    /**
     * Applies all stored event handlers to the DOM instance.
     */
    protected _applyEventListeners(): void;
    /**
     * Removes specified event handlers, or all if none are specified.
     * @param eventsList An array of event types to clear (or a single type).
     */
    clearEventListenersRecord<K extends keyof HTMLElementEventMap>(eventsList?: K | K[]): void;
    clearAllEventListenersAndRecords(): void;
    removeEventListeners<K extends keyof HTMLElementEventMap>(eventsList?: K | K[]): void;
    removeAllEventListeners(): void;
    /**
     * @returns the HTML string representing this element.
     */
    abstract toString(): string;
    private _removeChild;
    protected _removeChildren(children?: HTMDNode): void;
    /**
     * Removes this element from the DOM.
     */
    remove(): void;
    /**
     * Appends the element to the DOM using the configured container selector.
     * @param shouldRenderChildren Whether to render child nodes.
     */
    render(shouldRenderChildren?: boolean, childrenOptions?: ChildrenOptions): void;
    /**
     * Replaces the DOM instance of this element with a re-rendered version.
     * @param shouldRenderChildren Whether to render child nodes.
     */
    private _refresh;
    private _renderChild;
    /**
     * Handles child rendering, removing existing nodes from the DOM, and rendering them inside this element.
     * @param childContainerSelector Leave undefined to target the root of this element. Otherwise pass a valid child selector.
     * @example
     * const childContainerSelector = undefined // this.children -> rendered directly on this.instance
     * const childContainerSelector = ".child-wrapper" // this.children -> rendered on this.instance.find(".child-wrapper")
     */
    protected _renderChildren(children?: HTMDNode | undefined, options?: ChildrenOptions): void;
    /**
     * Returns the jQuery DOM instance, if it is present in the DOM.
     */
    get instance(): JQuery<HTMLElement> | null;
    /**
     * Returns the element's CSS selector.
     * @example
     * `${this._containerSelector} #${this.id}.${this.topClassBEM}`;
     */
    get selector(): string;
    /**
     * Returns true if the element currently exists in the DOM.
     */
    get isAlive(): boolean;
    /**
     * Returns the top-level BEM-style class for this element.
     */
    get topClassBEM(): string;
    /**
     * By default an UUID is used. Can be overridden.
     * This id can be used to identify both the object, and the DOM representation.
     */
    get id(): UUID;
    /**
     * A string containing all css classes attached to the element. Note that classes added via other
     * methods will not be present here. Internally FormControls use modifierClasses, but external
     * tools can also be used to add remove classes to the DOM. This is NOT the intended use.
     *
     * Setter method ensures that element classes are not removed
     * @example
     * MyElement.class ="special-class"
     * console.log(MyElement.class) //`${SPARC_PREFIX}__${this.name} special-class`
     */
    set class(classList: string);
    get class(): string;
    /**
     * Returns the lowercase class name responsible for creating this object.
     * This property is used to define the element's main class too
     */
    get name(): string;
    set containerSelector(selector: string);
    get containerSelector(): string;
    /**
     * An HTMDNode to be rendered on the DOM
     * When setting the property, If the element is loaded in the DOM, it's automatically refreshed
     */
    set children(children: HTMDNode);
    /**
     * An HTMDNode to be rendered on the DOM
     * When setting the property, If the element is loaded in the DOM, it's automatically refreshed
     */
    get children(): HTMDNode | undefined;
}

interface FormControlProps extends HTMDElementProps {
    /**
     * Use this boolean flag to toggle a css class disabling interactions with the component.
     */
    isDisabled?: boolean;
    /**
     * Use this boolean flag to toggle a css class while the async component loads.
     */
    isLoading?: boolean;
    /**
     * Currently used as a tooltip. Displays the current value by default
     */
    title?: string;
}
declare abstract class FormControl<T extends FormFieldType> extends HTMDElement {
    protected _value: FormField<T>;
    protected _isDisabled: boolean;
    protected _isLoading: boolean;
    title: string;
    constructor(fieldOrValue: T | FormField<T>, props?: FormControlProps);
    private get _validationClass();
    protected _validate(): void;
    toggleDisabledState(): void;
    toggleLoadingState(): void;
    get modifierClasses(): string;
    set class(str: string);
    get class(): string;
    get isValid(): boolean;
    get wasTouched(): boolean;
    get value(): FormField<T>;
    set isDisabled(flag: boolean);
    get isDisabled(): boolean;
    set isLoading(flag: boolean);
    get isLoading(): boolean;
}

type ContainerTags = 'div' | 'span' | 'header' | 'main' | 'footer' | 'section' | 'article' | 'nav';
interface ContainerProps extends HTMDElementProps {
    as?: ContainerTags;
    selectableItems?: boolean;
    onClickHandler?: (e: MouseEvent) => void;
}
declare class Container extends HTMDElement {
    protected _tag: ContainerTags;
    selectableItems: boolean;
    constructor(children: HTMDNode, props?: ContainerProps);
    protected get _modifierClasses(): string;
    toString(): string;
    set onClickHandler(callback: (e: MouseEvent) => void);
}

interface AccordionItemProps extends ContainerProps {
    isInitialOpen?: boolean;
    class?: string;
    onOpenCallback?: () => void;
    onCloseCallback?: () => void;
}
declare class AccordionItem extends Container {
    private _isOpen;
    private _header;
    onOpenCallback: () => void;
    onCloseCallback: () => void;
    constructor(header: string, children: HTMDNode, props?: AccordionItemProps);
    protected get _modifierClasses(): string;
    private _createIcon;
    private _createHeader;
    private _createBody;
    toString(): string;
    render(): void;
    protected _handleAccordionToggle(): void;
    protected _containerToggleEventListener(): void;
    close(): void;
    open(): void;
    toggle(): void;
    get isOpen(): boolean;
    protected _applyEventListeners(): void;
}

interface AccordionGroupProps extends ContainerProps {
    allowMultipleOpen?: boolean;
    openIndex?: number;
}
declare class AccordionGroup extends Container {
    protected _children?: AccordionItem[];
    allowMultipleOpen: boolean;
    constructor(children: AccordionItem[], props?: AccordionGroupProps);
    protected _closeAllOtherItems(index: number): void;
    protected _applyEventListeners(): void;
}

type CardVariants = 'primary' | 'secondary';
interface CardProps extends ContainerProps {
    /** Defines the element styling variant. Defaults to "primary" */
    variant?: CardVariants;
}
declare class Card extends Container {
    variant: CardVariants;
    constructor(children: HTMDNode, props?: CardProps);
    protected get _modifierClasses(): string;
}

interface FragmentProps {
    containerSelector?: string;
}
/**
 * A fragment is just an HTMDElement that renders multiple children without wrapping them on another element.
 *
 * Contrary to regular HTMDElements, a fragment can't contain all types of HTMDNode,
 * since Fragment will not act as a parent node in the DOM, it needs an implementation of the
 * HTMDElementInterface
 *
 * @see HTMDElementInterface
 */
declare class Fragment implements HTMDElementInterface {
    isHTMD: true;
    protected _children: HTMDElementInterface[];
    protected _containerSelector?: string;
    constructor(children: HTMDElementInterface[], props?: FragmentProps);
    get [Symbol.toStringTag](): string;
    protected _renderChild(child: HTMDElementInterface): void;
    render(): void;
    remove(): void;
    toString(): string;
    get children(): HTMDElementInterface[];
    get containerSelector(): string | undefined;
    set children(children: HTMDElementInterface[]);
    set containerSelector(selector: string);
}

interface ModalProps extends ContainerProps {
    /** Indicates whether to blur and darken the parent element */
    backdrop?: boolean;
    /** Indicates if Modal should be closed when user clicks outside it's bounding box. @default true*/
    closeOnFocusLoss?: boolean;
    /** Function that is called when the modal closes */
    onCloseHandler?: () => void;
    /** Function that is called when the modal opens */
    onOpenHandler?: () => void;
}
declare class Modal extends Container {
    backdrop: boolean;
    protected _isOpen: boolean;
    closeOnFocusLoss: boolean;
    protected _onCloseHandler: () => void;
    protected _onOpenHandler: () => void;
    constructor(children: HTMDNode, props?: ModalProps);
    render(): void;
    open(): void;
    close(): void;
    private _onFocusLossEventListener;
    protected _applyEventListeners(): void;
    protected get _modifierClasses(): string;
    set onCloseHandler(callback: () => void);
    set onOpenHandler(callback: () => void);
    get isVisible(): boolean | undefined;
}

interface SidePanelProps extends ModalProps {
    title: string;
    content: HTMDNode;
    footer?: HTMDNode;
    /** Panel width. Accepts any valid CSS width value. @default '400px' */
    width?: string;
}
declare class SidePanel extends Modal {
    protected _title: string;
    protected _width: string;
    constructor(props: SidePanelProps);
    protected get _modifierClasses(): string;
    render(): void;
    toString(): string;
    protected _applyEventListeners(): void;
    get title(): string;
    set title(value: string);
    get width(): string;
    set width(value: string);
}

interface ViewProps extends HTMDElementProps {
    onRefreshHandler?: () => void;
    showOnRender?: boolean;
}
declare class View extends HTMDElement {
    protected _onRefresh: (() => void) | (() => Promise<void>);
    showOnRender: boolean;
    constructor(children: HTMDNode, props: ViewProps);
    toString(): string;
    /**
     * @param show Boolean flag that indicates if the page should be displayed after rendering.
     * @returns
     */
    render(show?: boolean): void;
    hide(duration?: number, onCompleteCallback?: () => void): void;
    show(duration?: number, onCompleteCallback?: () => void): Promise<void>;
    toggleVisibility(duration?: number, onCompleteCallback?: () => void): void;
    get isVisible(): boolean | undefined;
    set children(children: HTMDNode);
    get children(): HTMDNode | undefined;
}

interface ViewSwitcherProps<K extends string> extends FragmentProps {
    containerSelector?: string;
    selectedViewName?: K;
    onRefreshHandler?: (viewName: K, viewIndex: number, view: View) => void;
}
/**
 * A ViewSwitcher is mean to control a set of views, like a sub router.
 * Handles content change and can be used for carousels or forms with multiple screens
 */
declare class ViewSwitcher<K extends string> extends Fragment {
    private _currentChild;
    private _currentViewName;
    protected _viewKeys: Record<K, number>;
    protected _children: View[];
    protected _onRefreshHandler: (viewName: K, viewIndex: number, view: View) => void;
    constructor(children?: [K, View][], props?: ViewSwitcherProps<K>);
    get [Symbol.toStringTag](): string;
    protected _renderChild(child: View): void;
    render(): void;
    addViews(...views: [K, View][]): void;
    setView(viewName: K): void;
    setViewByIndex(n: number): void;
    next: () => void;
    previous: () => void;
    get currentChild(): View;
    get currentViewName(): K;
    get currentViewIndex(): number;
}

type DialogVariants = 'info' | 'warning' | 'error';
interface DialogProps extends ModalProps {
    title: string;
    content: HTMDNode;
    footer: HTMDNode;
    variant: DialogVariants;
}
declare class Dialog extends Modal {
    protected _variant: DialogVariants;
    constructor(props: DialogProps);
}

interface LoaderProps extends HTMDElementProps {
    animation?: 'pulse';
}
declare class Loader extends HTMDElement {
    animation?: 'pulse';
    constructor(children: HTMDNode, props: LoaderProps);
    toString(): string;
    enable(): void;
    disable(): void;
    toggleLoader(): void;
}

interface ToastOptions {
    /**
     * Duration for which the toast should be displayed. -1 for permanent toast
     */
    duration?: number;
    autoClose?: boolean;
    /**
     * To show the toast from top or bottom
     */
    verticalAlign?: 'top' | 'bottom';
    /**
     * To show the toast on left or right
     */
    horizontalAlign?: 'left' | 'right';
    /**
     * Ability to provide custom class name for further customization
     */
    className?: string;
    /**
     * To stop timer when hovered over the toast (Only if duration is set)
     */
    stopOnFocus?: boolean;
    /**
     * Invoked when the toast is dismissed
     */
    onClose?: () => void;
    /**
     * Ability to add some offset to axis
     */
    offset?: {
        x?: number | string;
        y?: number | string;
    };
}
type ToastType = 'error' | 'success' | 'info' | 'warning';
interface ToastLoadingController {
    success(message: string, options?: ToastOptions): void;
    error(message: string, options?: ToastOptions): void;
    dismiss(): void;
}
interface ToastPromiseMessages<T> {
    loading: string;
    success: string | ((value: T) => string);
    error: string | ((reason: unknown) => string);
}
declare class Toast {
    private static readonly _defaults;
    private static _show;
    static success(message: string, options?: ToastOptions): void;
    static error(message: string, options?: ToastOptions): void;
    static info(message: string, options?: ToastOptions): void;
    static warning(message: string, options?: ToastOptions): void;
    static loading(message: string, options?: ToastOptions): ToastLoadingController;
    static promise<T>(promise: Promise<T>, messages: ToastPromiseMessages<T>, options?: ToastOptions): Promise<T>;
}

interface ButtonProps extends FormControlProps {
    /** HTML attr. Defaults to "button" */
    type?: 'button' | 'submit' | 'reset';
    /** Defines the element styling variant. @default "primary" */
    variant?: 'primary' | 'secondary' | 'danger';
    /** Applies the outlined styling variant. @default false */
    isOutlined?: boolean;
    /** Sets equal width/height, useful for styling Icon Buttons. @default false */
    squared?: boolean;
    /** */
    onClickHandler: (e: MouseEvent) => void;
    /**
     * Throttles the click callback to prevent accidental double-clicks / rapid repeat clicks.
     * `true` -> enabled at the default 300ms window. A number -> enabled with that window in ms.
     * `false` -> disabled (raw callback). Leading-edge: the first click fires immediately,
     * further clicks within the window are ignored. The window persists across re-renders.
     * @default true
     */
    throttle?: boolean | number;
}
declare class Button extends FormControl<string> {
    type: ButtonProps['type'];
    variant: ButtonProps['variant'];
    isOutlined: boolean;
    isSquared: boolean;
    private _clickThrottleMs;
    private _throttledClick;
    constructor(children: HTMDNode, props: ButtonProps);
    get modifierClasses(): string;
    toString(): string;
    set onClickHandler(callback: (e: MouseEvent) => void);
    remove(): void;
}

interface PeopleSearchResultData {
    Email?: string;
    Title?: string;
    Department?: string;
    MobilePhone?: string;
    SIPAddress?: string;
    PrincipalType?: string;
}
interface PeopleSearchResult {
    Key: string;
    DisplayText: string;
    IsResolved: boolean;
    EntityType: string;
    EntityData: PeopleSearchResultData;
    Description: string;
    ProviderName: string;
    ProviderDisplayName: string;
    MultipleMatches: PeopleSearchResult[];
}
interface SPUser {
    Id: number;
    LoginName: string;
    Title: string;
    Email: string;
}
interface SPGroup {
    Id: number;
    Title: string;
    Description: string;
    OwnerTitle: string;
}
interface ProfileProperty {
    Key: string;
    Value: string;
    ValueType: string;
}
interface UserProfilePayload {
    DisplayName: string;
    Email: string;
    Title: string;
    PictureUrl: string;
    PersonalUrl: string;
    DirectReports: unknown;
    ExtendedManagers: unknown;
    Peers: unknown;
    UserProfileProperties: unknown;
}
interface PeopleSearchOptions {
    /**
     * Maximum number of results to return.
     * @default 10
     */
    maximumSuggestions?: number;
    /**
     * Bitmask controlling which principal types to search.
     * Combine with bitwise OR for multiple types (e.g. User | SecurityGroup = 5).
     *
     * - `0`  -- None
     * - `1`  -- User (individual AD accounts)
     * - `2`  -- DistributionList (email distribution lists)
     * - `4`  -- SecurityGroup (AD security groups)
     * - `8`  -- SharePointGroup (SharePoint-only groups)
     * - `15` -- All (1 + 2 + 4 + 8)
     *
     * @default 1
     */
    principalType?: number;
    /**
     * Bitmask controlling which identity sources to search.
     * Combine with bitwise OR for multiple sources.
     *
     * - `0`  -- None
     * - `1`  -- UserInfoList (users already registered on the site)
     * - `2`  -- Windows (Active Directory)
     * - `4`  -- MembershipProvider (ASP.NET / Forms-Based Auth)
     * - `8`  -- RoleProvider (ASP.NET role providers)
     * - `15` -- All (1 + 2 + 4 + 8)
     *
     * @default 15
     */
    principalSource?: number;
    /**
     * When true, returns raw SharePoint results without normalization
     * (no phantom filtering, no MultipleMatches flattening, no dedup).
     * Resolution paths that need provider-specific Key selection use this.
     * @default false
     */
    raw?: boolean;
}
interface UserProfile {
    employeeId: string;
    loginName: string;
    displayName: string;
    email: string;
    jobTitle: string;
    pictureUrl: string;
    personalUrl: string;
    directReports: string[];
    managers: string[];
    peers: string[];
    profileProperties: Record<string, string>;
}
interface FullUserDetails extends UserProfile {
    siteUserId: number;
    groups: SPGroup[];
}

/**
 * @module CurrentUser
 *
 * Provides the {@link CurrentUser} async singleton for accessing the
 * authenticated user's profile, group memberships, and resolved access level.
 *
 * Access-level resolution is email-based (server-side OData filter via
 * {@link SiteApi.isUserInGroup}). This survives duplicate User Information List
 * entries that on-premises SharePoint creates when a "ghost" empty-email
 * principal coexists with the real one -- the numeric siteUserId can belong to
 * the ghost, making group lookups keyed on that ID return no memberships.
 *
 * @see {@link GroupHierarchyEntry} for configuring group-based access levels.
 * @see `src/base/sharepoint/api/people.api.ts` for the underlying API calls.
 * @see `src/base/types/sharepoint/people.types.ts` for type definitions.
 */

/**
 * Defines a single entry in the group hierarchy array passed to
 * {@link CurrentUser.initialize}. Entries are checked from last to first;
 * the first case-insensitive match against the user's SharePoint groups wins.
 */
interface GroupHierarchyEntry {
    /** SharePoint group title to match against (case-insensitive). */
    groupTitle: string;
    /** Short readable label (e.g. 'ADMIN', 'MEMBER', 'VISITOR'). */
    groupLabel: string;
}
/**
 * Optional settings for {@link CurrentUser.initialize}.
 */
interface InitializeOptions {
    /** Name or email of a target user to load instead of the authenticated user. Debug/testing feature. */
    targetUser?: string;
}
/**
 * Async singleton that holds the current user's profile and group hierarchy.
 *
 * Wraps {@link getFullUserDetails} from `people.api.ts`, which consolidates
 * data from `ensureUser`, `getuserbyid/groups`, `PeopleManager`, and the
 * People Picker into a single {@link FullUserDetails} object. The `email` and
 * `displayName` fields are picker-canonical: they come from the People Picker's
 * `EntityData.Email` and `DisplayText`, with fallback to UPS and ensureUser
 * values. This guarantees byte-identical email matches with {@link searchUsers}
 * results in orgs where a user has multiple AD accounts.
 *
 * **Lifecycle:**
 * 1. `const user = await new CurrentUser().initialize(groupHierarchy?, options?)` --
 *    preferred one-liner. `initialize()` returns `this` for chaining.
 *    Subsequent `new` calls return the same singleton instance.
 * 2. Access properties via the type-safe `get()` method or the convenience
 *    getters (`accessLevel`, `group`, `groupId`, `groupTitle`).
 *
 * **Error recovery:** if `initialize()` fails, the singleton reference is
 * cleared so that a subsequent `new CurrentUser()` creates a fresh instance
 * and `initialize()` can be retried.
 *
 * @example
 * ```ts
 * // Preferred: construct + initialize in one step (initialize returns this)
 * const user = await new CurrentUser().initialize(groupHierarchy);
 *
 * user.get('displayName'); // string
 * user.get('email');       // string
 * user.get('groups');      // SPGroup[]
 * user.accessLevel;        // 'ADMIN' | 'MEMBER' | ... | null
 * user.set('jobTitle', 'Sr. Engineer'); // type-safe override
 * console.log(user.toString());         // JSON snapshot for debugging
 *
 * // Debug: load another user's profile instead of the authenticated user
 * const user = await new CurrentUser().initialize(hierarchy, { targetUser: 'john@company.com' });
 * ```
 *
 * @see {@link FullUserDetails} for the complete list of properties available via `get()`.
 * @see {@link GroupHierarchyEntry} for the group hierarchy configuration format.
 */
declare class CurrentUser {
    #private;
    /**
     * Creates or returns the singleton `CurrentUser` instance.
     *
     * This constructor never throws. If an instance already exists, it is
     * returned directly (standard singleton pattern). The returned object is
     * **not** initialized -- call {@link initialize} before accessing any
     * user data.
     *
     * @returns The singleton `CurrentUser` instance (via constructor return override).
     */
    constructor();
    /**
     * Loads user details from SharePoint and resolves the group hierarchy.
     *
     * Idempotent -- returns `this` immediately on subsequent calls once
     * initialization has succeeded.
     *
     * Access-level resolution uses email-based server-side OData filtering
     * ({@link SiteApi.isUserInGroup}) rather than the numeric siteUserId.
     * On-premises SharePoint may create a stale "ghost" principal with an empty
     * `Email` alongside the real UIL entry for the same AD account; that ghost
     * principal can receive the lower numeric ID, making `data.groups` (which is
     * keyed on siteUserId) return an empty list for the authenticated user.
     * Email is a stable, AD-authoritative identifier that is not affected by
     * duplicate UIL entries.
     *
     * For the authenticated user (when `options.targetUser` is not set), group
     * resolution uses `_spPageContextInfo.userEmail` as the email key, falling
     * back to the email returned by {@link getFullUserDetails} only if the session
     * email is absent. The session email comes from the authenticated session and
     * is immune to ghost UIL entries. When `options.targetUser` IS set, the
     * session email belongs to the authenticated user, not the target, so
     * `data.email` (from the target's profile) is used exclusively.
     *
     * The `email` and `displayName` stored in `#data` (accessible via `get('email')`
     * and `get('displayName')`) are the picker-canonical values returned by
     * {@link getFullUserDetails} -- `EntityData.Email` and `DisplayText` from the
     * People Picker, with fallback to UPS and ensureUser values. They are not
     * altered here.
     *
     * @param groupHierarchy - Optional ordered list of groups from lowest to
     *   highest privilege. The array is walked from last index to first; the
     *   highest-priority match wins (parallel membership checks per entry).
     * @param options - Optional settings. Use `options.targetUser` to load a
     *   different user's profile (debug/testing).
     * @returns A Promise resolving with the initialized `CurrentUser` instance.
     * @throws {SystemError} `CurrentUserInitError` if the underlying API calls fail.
     */
    initialize(groupHierarchy?: GroupHierarchyEntry[], options?: InitializeOptions): Promise<CurrentUser>;
    /**
     * Type-safe accessor for any property on the underlying {@link FullUserDetails}.
     *
     * Available keys (from {@link FullUserDetails} which extends {@link UserProfile}):
     * - `loginName` -- claims-encoded login (e.g. `"i:0#.w|DOMAIN\\user"`)
     * - `displayName` -- user's display name
     * - `email` -- primary email address
     * - `siteUserId` -- numeric ID on the current site (from `ensureUser`)
     * - `jobTitle` -- job title from the user profile
     * - `pictureUrl` -- profile picture URL
     * - `personalUrl` -- MySite / OneDrive personal URL
     * - `directReports` -- login names of direct reports
     * - `managers` -- login names of managers (extended hierarchy)
     * - `peers` -- login names of peers
     * - `groups` -- SharePoint groups the user belongs to ({@link SPGroup}[])
     * - `profileProperties` -- all non-empty profile properties as key-value pairs
     *
     * @typeParam K - A key of `FullUserDetails`.
     * @param key - The property name to retrieve.
     * @returns The value for that key, with the correct narrowed type.
     * @throws {SystemError} `CurrentUserNotInitialized` if called before initialization.
     */
    get<K extends keyof FullUserDetails>(key: K): FullUserDetails[K];
    /**
     * Type-safe setter for any property on the underlying {@link FullUserDetails}.
     *
     * This is a data-override escape hatch. Setting `'groups'` does **not**
     * re-resolve the group hierarchy -- that is resolved once during
     * {@link initialize}.
     *
     * @typeParam K - A key of `FullUserDetails`.
     * @param key - The property name to set.
     * @param value - The value to assign (must match the key's type).
     * @throws {SystemError} `CurrentUserNotInitialized` if called before initialization.
     */
    set<K extends keyof FullUserDetails>(key: K, value: FullUserDetails[K]): void;
    /**
     * The `groupLabel` from the highest-priority matched {@link GroupHierarchyEntry},
     * or `null` if no hierarchy was provided to `initialize()` or none of the
     * user's SharePoint groups matched any hierarchy entry.
     *
     * @throws {SystemError} `CurrentUserNotInitialized` if called before initialization.
     */
    get accessLevel(): string | null;
    /**
     * The full {@link SPGroup} object for the matched hierarchy entry, or `null`
     * if no hierarchy was provided or no match was found.
     *
     * @throws {SystemError} `CurrentUserNotInitialized` if called before initialization.
     */
    get group(): SPGroup | null;
    /**
     * The numeric ID (`SPGroup.Id`) of the matched SharePoint group, or `null`.
     *
     * @throws {SystemError} `CurrentUserNotInitialized` if called before initialization.
     */
    get groupId(): number | null;
    /**
     * The title (`SPGroup.Title`) of the matched SharePoint group, or `null`.
     *
     * @throws {SystemError} `CurrentUserNotInitialized` if called before initialization.
     */
    get groupTitle(): string | null;
    /**
     * Whether `initialize()` has completed successfully.
     * This is the only getter that does NOT require initialization.
     */
    get isInitialized(): boolean;
    /**
     * Returns a JSON string of all user data plus resolved hierarchy info.
     * Useful for logging and debugging.
     *
     * @returns Single-line JSON containing all {@link FullUserDetails} properties
     *   plus `accessLevel`, `groupId`, and `groupTitle` from the resolved hierarchy.
     * @throws {SystemError} `CurrentUserNotInitialized` if called before initialization.
     */
    toString(): string;
}

/**
 * @module UserIdentity
 *
 * Provides the {@link UserIdentity} value class for canonical serialization
 * of user identity data in SharePoint list fields.
 *
 * Serialization integrates with ListApi's auto-serialization and auto-parsing:
 *
 * **Write:** Pass a `UserIdentity` directly as a field value -- ListApi calls
 * `JSON.stringify()`, which invokes `toJSON()` producing `{ email, displayName, ...properties }`.
 *
 * **Read:** ListApi auto-parses the JSON string back to a plain object --
 * `fromField()` accepts the resulting object and restores custom properties.
 *
 * **Multi-user:** Pass `UserIdentity[]` -- ListApi serializes the array;
 * `manyFromField()` accepts the auto-parsed array.
 *
 * **Custom properties:** Each instance can carry extensible key-value properties
 * (string, number, or boolean values) that survive serialization round-trips.
 * Use the constructor's third parameter, or the `with()` method to derive a
 * new instance with merged properties.
 *
 * @see {@link CurrentUser} for the authenticated user singleton.
 * @see `src/base/sharepoint/api/people.api.ts` for people search and profile APIs.
 */

/**
 * Extensible property bag for custom key-value data attached to a UserIdentity.
 * Values are limited to primitives that survive JSON serialization round-trips.
 */
type UserIdentityProperties = Record<string, string | number | boolean>;
/**
 * Immutable value class wrapping user identity data (email, displayName)
 * with canonical JSON serialization for SharePoint list storage.
 *
 * @example
 * ```ts
 * const ref = new UserIdentity('rlopes@co.com', 'Rafael Lopes');
 *
 * // -- Implicit serialization (JSON via ListApi) --
 * await listApi.createItem({ AssignedTo: ref });       // auto-serialized via toJSON()
 * const assignee = UserIdentity.fromField(item.AssignedTo); // handles auto-parsed object
 *
 * // -- Multi-user --
 * await listApi.createItem({ Reviewers: [ref1, ref2] });  // JSON array
 * const reviewers = UserIdentity.manyFromField(item.Reviewers);
 * ```
 */
declare class UserIdentity {
    #private;
    readonly email: string;
    readonly displayName: string;
    /**
     * Creates a new `UserIdentity` instance.
     *
     * @param email - The user's email address. Must not be empty.
     * @param displayName - The user's display name. Allowed to be empty.
     * @param properties - Optional custom key-value properties. Keys `email` and
     *   `displayName` are silently filtered out to prevent collision with core fields.
     *   Only string, number, and boolean values are retained.
     * @throws {SystemError} `InvalidUserIdentity` (non-breaking) if email is empty/whitespace.
     */
    constructor(email: string, displayName: string, properties?: UserIdentityProperties);
    /**
     * Returns the full user details fetched by {@link fetchFullDetails},
     * or `null` if not yet fetched.
     */
    get details(): FullUserDetails | null;
    /**
     * Returns a custom property value, or `undefined` if the key does not exist.
     */
    prop(key: string): string | number | boolean | undefined;
    /**
     * Returns `true` if a custom property with the given key exists.
     */
    hasProp(key: string): boolean;
    /**
     * Returns the frozen custom properties object.
     */
    get properties(): Readonly<UserIdentityProperties>;
    /**
     * Returns a new `UserIdentity` with merged properties. Existing properties
     * are overwritten by the new values. Core fields (`email`, `displayName`)
     * and the cached `details` carry over.
     */
    with(properties: UserIdentityProperties): UserIdentity;
    /**
     * Returns a plain object for `JSON.stringify()`.
     *
     * ListApi's `toFieldValue()` calls `JSON.stringify` on object field values,
     * which invokes this method. This enables implicit serialization:
     * `listApi.createItem({ AssignedTo: ref })` -- no manual conversion needed.
     */
    toJSON(): {
        email: string;
        displayName: string;
    } & UserIdentityProperties;
    /**
     * Parses a list field value into a `UserIdentity` instance.
     *
     * Accepts a plain object `{ email, displayName }` -- the format produced by
     * ListApi's auto-parsing of JSON-serialized `UserIdentity` values.
     *
     * @param value - A field value from a list item (auto-parsed object).
     * @returns A `UserIdentity` instance, or `null` if the value is
     *   null/undefined, not an object, or contains invalid data.
     */
    static fromField(value: unknown): UserIdentity | null;
    /**
     * Parses a multi-user list field value into an array of `UserIdentity`
     * instances. Malformed entries are silently skipped.
     *
     * Accepts an array -- the format produced by ListApi's auto-parsing of
     * JSON-serialized `UserIdentity[]` values.
     *
     * @param value - A field value from a list item (auto-parsed array).
     * @returns An array of successfully parsed `UserIdentity` instances.
     */
    static manyFromField(value: unknown): UserIdentity[];
    /**
     * Creates a `UserIdentity` from a PeoplePicker search result.
     *
     * Extracts the email from `EntityData.Email` and the display name
     * from `DisplayText`.
     *
     * @param result - A {@link PeopleSearchResult} from `searchUsers()` or PeoplePicker resolution.
     * @returns A new `UserIdentity` instance.
     */
    static fromSearchResult(result: PeopleSearchResult): UserIdentity;
    /**
     * Creates a `UserIdentity` from an initialized {@link CurrentUser} singleton.
     *
     * @param user - An initialized `CurrentUser` instance.
     * @returns A new `UserIdentity` instance.
     * @throws {SystemError} `CurrentUserNotInitialized` if the user has not been initialized.
     */
    static fromCurrentUser(user: CurrentUser): UserIdentity;
    /**
     * Fetches the full user details from SharePoint for this identity and
     * stores them in {@link details}.
     *
     * Uses the stored `email` as the lookup key, which `getFullUserDetails`
     * resolves to a claims login via people picker search. The result includes
     * site-level ID, group memberships, profile properties, and more.
     *
     * @throws When the user cannot be resolved on the site (ensureUser failure).
     */
    fetchFullDetails(): Promise<void>;
    /**
     * Returns the display name for string coercion contexts.
     */
    toString(): string;
}

interface PeoplePickerProps extends Omit<ComboBoxProps, 'filteringFunction' | 'allowFiltering' | 'allowCreate' | 'onSelectHandler' | 'returnFullDataset'> {
    /** Debounce delay in milliseconds before firing a search request. @default 300 */
    debounceMs?: number;
    /** Minimum number of characters required before searching. @default 2 */
    minimumCharacters?: number;
    /** Maximum number of results to return from the people picker endpoint. */
    maximumSuggestions?: number;
    /** Bitmask controlling which principal types to search. @default 1 (User) */
    principalType?: number;
    /** Bitmask controlling which identity sources to search. @default 15 (All) */
    principalSource?: number;
}
declare class PeoplePicker extends ComboBox {
    private _minimumCharacters;
    private _searchOptions;
    private _debouncedSearch;
    private _lastSearchResults;
    private _isMultiple;
    constructor(field: FormField<ComboBoxOptionProps | ComboBoxOptionProps[]>, props: PeoplePickerProps);
    private _executeSearch;
    protected _onSearchEventListeners(): void;
    protected _emptyMessage(): string;
    remove(): void;
    /**
     * Searches Active Directory for the given identifier and, if a unique match
     * is found, selects it in the picker and updates the bound FormField.
     *
     * Use this to pre-populate PeoplePickers with stored user identifiers
     * (emails, employee IDs, login names) from SharePoint list items while
     * validating them against AD.
     *
     * @param identifier - Email, claims login, display name, or employee ID.
     * @returns The matched {@link PeopleSearchResult} on success, or `null` if
     *          the identifier could not be resolved to a single AD entry.
     */
    resolveUser(identifier: string): Promise<PeopleSearchResult | null>;
    /** UserIdentity from the current single selection, or null. */
    get selectedIdentity(): UserIdentity | null;
    /** UserIdentity array from all current selections. */
    get selectedIdentities(): UserIdentity[];
    /** Raw PeopleSearchResult array from the last completed query. */
    get queryResults(): PeopleSearchResult[];
}

type DATE_FORMATS = 'dd-mm-yyyy' | 'mm-dd-yyyy' | 'yyyy-mm-dd';
interface DateInputProps extends FormControlProps {
    format?: DATE_FORMATS;
    placeholder?: string;
}
declare const FORMAT_MAP: Record<DATE_FORMATS, string>;
declare class DateInput extends FormControl<string> {
    format: DATE_FORMATS;
    private _placeholder;
    private _dayjsFormat;
    private _viewDate;
    private _selectedDate;
    private _isCalendarOpen;
    private _pendingTimeouts;
    constructor(fieldOrValue: string | FormField<string>, props?: DateInputProps);
    private _trackTimeout;
    private _clearAllTimeouts;
    private _createCalendarPanel;
    private _createCalendarBody;
    private _openCalendar;
    private _closeCalendar;
    private _refreshCalendarContent;
    private _syncValueFromInput;
    private _applyDateSelection;
    /**
     * Sets the date programmatically and syncs internal state + DOM.
     * Used by DateRangeInput to adjust the paired date without closing the calendar.
     */
    setDate(date: dayjs.Dayjs): void;
    private _bindDayClickHandlers;
    protected _applyEventListeners(): void;
    get modifierClasses(): string;
    toString(): string;
    render(): void;
    remove(): void;
}

interface DateRangeRules {
    /** Maximum allowed range in days */
    maxDays?: number;
    /** Minimum required range in days */
    minDays?: number;
    /** Absolute earliest date (formatted per display format) */
    minDate?: string;
    /** Absolute latest date (formatted per display format) */
    maxDate?: string;
}
interface DateRangeInputProps extends HTMDElementProps {
    format?: DATE_FORMATS;
    /** Placeholder text shown when no range is selected (default: "Select date range") */
    placeholder?: string;
    isDisabled?: boolean;
    rules?: DateRangeRules;
    /** Duration unit label in footer summary (default: "days"), e.g. "nights" */
    summaryLabel?: string;
}
declare class DateRangeInput extends HTMDElement {
    readonly startField: FormField<string>;
    readonly endField: FormField<string>;
    private _format;
    private _dayjsFormat;
    private _placeholder;
    private _summaryLabel;
    private _rules;
    private _isDisabled;
    private _minDate;
    private _maxDate;
    private _viewDate;
    private _startDate;
    private _endDate;
    private _selectingEnd;
    private _hoverDate;
    private _isPanelOpen;
    private _syncing;
    private _unsubStart;
    private _unsubEnd;
    private _pendingTimeouts;
    constructor(startField: FormField<string>, endField: FormField<string>, props?: DateRangeInputProps);
    get isDisabled(): boolean;
    set isDisabled(value: boolean);
    open(): void;
    close(): void;
    private _trackTimeout;
    private _clearAllTimeouts;
    private _parseFieldValue;
    private _isDateDisabled;
    private _createMonthBody;
    private _createPanel;
    private _getInputDisplayValue;
    private _createSummaryText;
    private _syncInputDisplay;
    private _openPanel;
    private _closePanel;
    private _refreshPanelContent;
    private _onDayClick;
    private _applyHoverPreview;
    private _clearHoverPreview;
    private _updateHoverSummary;
    private _bindDayHandlers;
    protected _applyEventListeners(): void;
    private _onExternalFieldChange;
    toString(): string;
    render(): void;
    remove(): void;
}

interface NumberInputProps extends FormControlProps {
    min?: number;
    step?: number;
    max?: number;
    /** Debounce delay in milliseconds for syncing value on keystroke. @default 300 */
    debounceMs?: number;
}
declare class NumberInput extends FormControl<number> {
    min?: number;
    step?: number;
    max?: number;
    private _debouncedSync;
    constructor(fieldOrValue: number | FormField<number>, props: NumberInputProps);
    private _syncValue;
    protected _applyEventListeners(): void;
    remove(): void;
    toString(): string;
}

interface TextAreaProps extends FormControlProps {
    placeholder?: string;
    spellcheck?: boolean;
    autocomplete?: boolean;
    /** Debounce delay in milliseconds for syncing value on keystroke. @default 300 */
    debounceMs?: number;
    /** Number of visible text rows. @default 4 */
    rows?: number;
    /** Maximum character length. No limit if undefined. */
    maxLength?: number;
    /** CSS resize behavior. @default 'vertical' */
    resize?: 'none' | 'vertical' | 'horizontal' | 'both';
    /** Automatically adjust height to fit content. @default false */
    autoResize?: boolean;
}
declare class TextArea extends FormControl<string> {
    placeholder: string;
    spellcheck: boolean;
    autocomplete: boolean;
    rows: number;
    maxLength?: number;
    resize: 'none' | 'vertical' | 'horizontal' | 'both';
    autoResize: boolean;
    private _debouncedSync;
    constructor(fieldOrValue: string | FormField<string>, props?: TextAreaProps);
    private _syncValue;
    private _autoResize;
    protected _applyEventListeners(): void;
    remove(): void;
    toString(): string;
}

interface TextInputProps extends FormControlProps {
    spellcheck?: boolean;
    autocomplete?: boolean;
    hideChars?: boolean;
    placeholder?: string;
    /** Debounce delay in milliseconds for syncing value on keystroke. @default 300 */
    debounceMs?: number;
}
declare class TextInput extends FormControl<string> {
    spellcheck: boolean;
    autocomplete: boolean;
    hideChars: boolean;
    placeholder: string;
    private _debouncedSync;
    constructor(fieldOrValue: string | FormField<string>, props: TextInputProps);
    private _syncValue;
    protected _applyEventListeners(): void;
    remove(): void;
    toString(): string;
}

declare class CheckBox extends FormControl<boolean> {
    constructor(fieldOrValue: boolean | FormField<boolean>, props: FormControlProps);
    protected _applyEventListeners(): void;
    toString(): string;
}

interface ListProps<T extends string | number> extends HTMDElementProps {
    headers: string[];
    data: T[][];
    emptyListMessage?: string;
    onItemSelectHandler?: (rowData: T[]) => void;
}
declare class List<T extends string | number> extends HTMDElement {
    headers: string[];
    protected _data: T[][];
    private _orderedData;
    emptyListMessage: string;
    onItemSelectHandler: (rowData: T[]) => void;
    constructor(props: ListProps<T>);
    private _createHeaders;
    private _createRow;
    private _createListItems;
    toString(): string;
    private _refreshDataset;
    private _defaultOrderingFn;
    private _applySortClass;
    private _handleHeaderSortEvent;
    private _onHeaderSortEventListeners;
    private _onItemSelectEventListeners;
    private _applyDatasetEventListeners;
    protected _applyEventListeners(): void;
    set data(data: T[][]);
    get data(): T[][];
    get isDataValid(): boolean;
    throwOnInvalidListData(): void;
}

declare const REMIXICON_CORE: {
    readonly 'account-circle-fill': string;
    readonly 'account-circle-line': string;
    readonly 'add-circle-fill': string;
    readonly 'add-circle-line': string;
    readonly 'add-line': string;
    readonly 'admin-fill': string;
    readonly 'admin-line': string;
    readonly 'alert-fill': string;
    readonly 'alert-line': string;
    readonly 'arrow-down-line': string;
    readonly 'arrow-down-s-line': string;
    readonly 'arrow-go-back-line': string;
    readonly 'arrow-go-forward-line': string;
    readonly 'arrow-left-line': string;
    readonly 'arrow-left-s-line': string;
    readonly 'arrow-right-line': string;
    readonly 'arrow-right-s-line': string;
    readonly 'arrow-up-line': string;
    readonly 'arrow-up-s-line': string;
    readonly 'attachment-line': string;
    readonly 'calendar-fill': string;
    readonly 'calendar-line': string;
    readonly 'chat-1-fill': string;
    readonly 'chat-1-line': string;
    readonly 'check-fill': string;
    readonly 'check-line': string;
    readonly 'checkbox-circle-fill': string;
    readonly 'checkbox-circle-line': string;
    readonly 'clipboard-line': string;
    readonly 'close-circle-fill': string;
    readonly 'close-circle-line': string;
    readonly 'close-line': string;
    readonly 'contacts-book-fill': string;
    readonly 'contacts-book-line': string;
    readonly 'contacts-fill': string;
    readonly 'contacts-line': string;
    readonly 'dashboard-fill': string;
    readonly 'dashboard-line': string;
    readonly 'delete-bin-fill': string;
    readonly 'delete-bin-line': string;
    readonly 'discuss-fill': string;
    readonly 'discuss-line': string;
    readonly 'download-fill': string;
    readonly 'download-line': string;
    readonly 'edit-2-line': string;
    readonly 'edit-line': string;
    readonly 'error-warning-fill': string;
    readonly 'error-warning-line': string;
    readonly 'external-link-line': string;
    readonly 'eye-fill': string;
    readonly 'eye-line': string;
    readonly 'eye-off-line': string;
    readonly 'feedback-fill': string;
    readonly 'feedback-line': string;
    readonly 'file-add-line': string;
    readonly 'file-copy-line': string;
    readonly 'file-download-line': string;
    readonly 'file-line': string;
    readonly 'file-text-line': string;
    readonly 'file-upload-line': string;
    readonly 'filter-fill': string;
    readonly 'filter-line': string;
    readonly 'folder-line': string;
    readonly 'folder-open-line': string;
    readonly 'fullscreen-exit-line': string;
    readonly 'fullscreen-line': string;
    readonly 'group-fill': string;
    readonly 'group-line': string;
    readonly 'heart-fill': string;
    readonly 'heart-line': string;
    readonly 'home-fill': string;
    readonly 'home-line': string;
    readonly 'information-fill': string;
    readonly 'information-line': string;
    readonly link: string;
    readonly 'link-unlink': string;
    readonly 'loader-fill': string;
    readonly 'loader-line': string;
    readonly 'lock-fill': string;
    readonly 'lock-line': string;
    readonly 'lock-unlock-line': string;
    readonly 'login-box-line': string;
    readonly 'logout-box-line': string;
    readonly 'logout-box-r-line': string;
    readonly 'mail-fill': string;
    readonly 'mail-line': string;
    readonly 'menu-fill': string;
    readonly 'menu-line': string;
    readonly 'message-fill': string;
    readonly 'message-line': string;
    readonly 'more-2-line': string;
    readonly 'more-fill': string;
    readonly 'more-line': string;
    readonly 'notification-fill': string;
    readonly 'notification-line': string;
    readonly 'pause-line': string;
    readonly 'phone-fill': string;
    readonly 'phone-line': string;
    readonly 'play-line': string;
    readonly 'question-fill': string;
    readonly 'question-line': string;
    readonly 'refresh-line': string;
    readonly 'save-fill': string;
    readonly 'save-line': string;
    readonly 'search-eye-line': string;
    readonly 'search-line': string;
    readonly 'settings-3-line': string;
    readonly 'settings-fill': string;
    readonly 'settings-line': string;
    readonly 'share-fill': string;
    readonly 'share-line': string;
    readonly 'shield-check-fill': string;
    readonly 'shield-check-line': string;
    readonly 'sort-asc': string;
    readonly 'sort-desc': string;
    readonly 'star-fill': string;
    readonly 'star-line': string;
    readonly 'stop-line': string;
    readonly 'subtract-line': string;
    readonly 'team-fill': string;
    readonly 'team-line': string;
    readonly 'time-fill': string;
    readonly 'time-line': string;
    readonly 'upload-fill': string;
    readonly 'upload-line': string;
    readonly 'user-add-fill': string;
    readonly 'user-add-line': string;
    readonly 'user-fill': string;
    readonly 'user-follow-fill': string;
    readonly 'user-follow-line': string;
    readonly 'user-line': string;
    readonly 'user-search-fill': string;
    readonly 'user-search-line': string;
    readonly 'user-settings-fill': string;
    readonly 'user-settings-line': string;
    readonly 'user-shared-fill': string;
    readonly 'user-shared-line': string;
    readonly 'user-unfollow-fill': string;
    readonly 'user-unfollow-line': string;
};

type IconSource = Record<string, string>;
type BuiltInIconName = keyof typeof REMIXICON_CORE;
type IconName = BuiltInIconName | (string & {});
/**
 * Registers a named icon source in the global icon registry.
 *
 * Custom sources are resolved after built-in icons by insertion order --
 * the most recently registered source takes priority when names collide.
 * Re-registering the same `sourceName` replaces the previous set in place.
 *
 * @param sourceName - Unique identifier for the icon set (e.g. `'company-icons'`).
 * @param icons - A record mapping icon names to raw SVG strings.
 * @throws {SystemError} `'InvalidArgument'` if `sourceName` is empty or `icons` is not a non-empty object.
 *
 * @example
 * ```ts
 * registerIcons('my-app', {
 *   'logo': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">...</svg>',
 *   'brand-mark': '<svg ...>...</svg>',
 * });
 *
 * getIcon('logo');       // resolves from 'my-app'
 * getIcon('check-fill'); // resolves from built-in 'remixicon'
 * ```
 */
declare function registerIcons(sourceName: string, icons: IconSource): void;
declare function getIcon(iconName: IconName): string;
/**
 * Logs all registered icon sources and their icon names to the console.
 *
 * Each source is printed as a collapsed group with the source name and icon count.
 * Icons within each group are sorted alphabetically. A summary line with the
 * total icon count and number of sources is printed at the end.
 *
 * Intended as a development/debugging aid -- call from the browser console
 * or during app startup to inspect available icons.
 *
 * @example
 * ```ts
 * listIcons();
 * // > remixicon (145 icons)
 * //     account-circle-fill, account-circle-line, ...
 * // > my-app (3 icons)
 * //     brand-mark, logo, spinner
 * // Total: 148 icons across 2 source(s)
 * ```
 */
declare function listIcons(): void;

interface ImageProps extends HTMDElementProps {
    alt?: string;
    onLoad?: () => void;
}
declare class Image extends HTMDElement {
    private _src;
    private _alt?;
    private _onLoadCallback;
    constructor(src: string, props: ImageProps);
    private _preloader;
    render(_shouldRenderChildren?: boolean): void;
    toString(): string;
}

/**
 * Configuration options for StyleResource initialization.
 */
interface StyleResourceOptions {
    /**
     * Whether the stylesheet should be enabled on load.
     * @default true
     */
    enable?: boolean;
}
/**
 * Manages dynamic loading and manipulation of CSS stylesheets in the document head.
 *
 * Provides methods to load, enable, disable, and remove stylesheet resources at runtime.
 * Supports path resolution with SharePoint context using the `@` prefix.
 *
 * @example
 * ```ts
 * // Load a stylesheet from SharePoint site collection
 * const styles = new StyleResource('@/SiteAssets/custom.css');
 *
 * // Load disabled initially
 * const conditionalStyles = new StyleResource('/styles/theme.css', { enable: false });
 *
 * // Enable/disable dynamically
 * conditionalStyles.enable();
 * conditionalStyles.disable();
 *
 * // Remove from DOM
 * styles.remove();
 * ```
 */
declare class StyleResource {
    /**
     * Resolved absolute path to the stylesheet resource.
     */
    private _path;
    /**
     * Direct reference to the `<link>` element in the document head.
     * Avoids re-querying the DOM by href on every operation.
     */
    private _link;
    /**
     * Resolves when the stylesheet has been loaded by the browser, or rejects on load failure.
     * Allows callers to await CSS availability before rendering to prevent FOUC.
     *
     * Fire-and-forget usage (no await) is safe -- the constructor swallows the rejection.
     */
    readonly ready: Promise<void>;
    /**
     * Creates a new StyleResource instance and loads the stylesheet into the document head.
     *
     * @param path - Path to the stylesheet. Use `@` prefix for SharePoint-relative paths.
     * @param options - Configuration options for the stylesheet.
     * @throws {SystemError} If the path is not a non-empty string.
     */
    constructor(path: string, options?: StyleResourceOptions);
    /**
     * Creates and appends a `<link>` element to the document head.
     * Attaches load/error listeners that resolve/reject the returned promise.
     * On error, the element is removed from the DOM and the internal reference is cleared.
     *
     * @param enabled - Whether the stylesheet should be enabled on load.
     * @returns A promise that resolves when the stylesheet loads, or rejects on failure.
     */
    private _loadFile;
    /**
     * Disables the stylesheet by setting the `disabled` attribute.
     * The stylesheet remains in the DOM but is not applied.
     */
    disable(): void;
    /**
     * Enables the stylesheet by removing the `disabled` attribute.
     */
    enable(): void;
    /**
     * Removes the stylesheet `<link>` element from the document head.
     */
    remove(): void;
}

interface RouteOptions extends Omit<ViewProps, 'containerSelector'> {
    routeStylePath?: string;
    children?: HTMDNode;
    title?: string;
}
declare class Route extends View {
    title: string;
    protected _routeStyle?: StyleResource;
    constructor(props?: RouteOptions);
    hide(duration?: number, onCompleteCallback?: () => void): void;
    show(duration?: number, onCompleteCallback?: () => void): Promise<void>;
    set routeStylePath(path: string);
    set onRefreshHandler(callback: () => void);
}

/** Function that determines whether navigation should proceed.
 * - `true` -- allow navigation
 * - `false` -- silently block navigation
 * - `string` -- show a confirmation Dialog with that message; user chooses "Stay" or "Leave"
 */
type NavigationGuardFn = () => boolean | string;
/** Options passed to {@link Router.navigateTo}. */
interface NavigationOptions {
    /** Key-value pairs appended to the URL as query parameters. */
    query?: Record<string, string>;
    /** When `true`, opens the target route in a new browser tab instead of navigating in-place. */
    newTab?: boolean;
}
/** Constructor options for {@link Router}. */
interface RouterProps {
    /** CSS selector for the DOM element that hosts rendered routes. Defaults to `"#root"`. */
    containerSelector?: string;
    /** Wraps route rendering in an {@link ErrorBoundary}. Defaults to `true`. */
    enableErrorBoundary: boolean;
    /**
     * Custom route rendered when navigating to an unregistered path.
     * Accepts a {@link Route} or a `Promise<Route>` (e.g. from {@link defineRoute}).
     * When omitted, a built-in 404 page is shown that auto-redirects to home after 8 seconds.
     */
    notFoundRoute?: Route | Promise<Route>;
    /**
     * Custom route rendered when the user lacks permission to access the application.
     * Accepts a {@link Route} or a `Promise<Route>` (e.g. from {@link defineRoute}).
     * When omitted, a built-in 403 page is shown with a generic access denied message.
     */
    unauthorizedRoute?: Route | Promise<Route>;
}
/** Array of route path strings registered with the Router. */
type RoutePaths = string[];
/**
 * Hash-based singleton router for SPARC applications.
 *
 * Manages navigation between {@link Route} instances using `location.hash`. Routes are
 * lazy-loaded on first visit and cached for subsequent navigations. A
 * {@link NavigationEvent} is dispatched on `window` after every transition.
 *
 * Follows the singleton pattern -- only the first `new Router(...)` call initialises
 * the instance. Subsequent calls return the existing instance. All navigation is done
 * through static methods so application code never needs a direct reference.
 *
 * @example
 * ```ts
 * // Initialise once at application entry point
 * new Router(['dashboard', 'settings', 'users/list'], {
 *   enableErrorBoundary: true,
 * });
 *
 * // Navigate from anywhere
 * Router.navigateTo('dashboard');
 * Router.navigateTo('settings', { query: { tab: 'general' } });
 * Router.goBack();
 * ```
 */
declare class Router {
    #private;
    /** The singleton Router instance, set on first construction. */
    protected static _runtimeInstance: Router;
    /**
     * Navigates to the given route path.
     *
     * Resolves relative paths (`./child`) against the current location. Supports
     * query parameters and new-tab navigation via {@link NavigationOptions}.
     *
     * @param path - Absolute (`"dashboard"`) or relative (`"./detail"`) route path.
     * @param options - Optional query parameters and navigation behaviour.
     *
     * @throws {SystemError} If the Router has not been initialised.
     */
    static navigateTo(path: string, options?: NavigationOptions): void;
    /** Delegates to `history.back()`. The popstate listener handles re-rendering. */
    static goBack(): void;
    /**
     * Navigates up `x` segments in the current path.
     *
     * Unlike {@link goBack}, which follows browser history, `popLevel` operates on the
     * URL structure. Navigating from `"a/b/c"` with `popLevel(1)` goes to `"a/b"`.
     *
     * @param x - Number of path segments to remove. Defaults to `1`.
     * @throws {SystemError} If the Router has not been initialised.
     */
    static popLevel(x?: number): void;
    /**
     * Renders the unauthorized access page.
     *
     * Tears down the current route and displays the 403 page. Does not push
     * a history entry -- unauthorized is a terminal state, not a navigable route.
     *
     * @throws {SystemError} If the Router has not been initialised.
     */
    static unauthorized(): void;
    /**
     * Sets a navigation guard that is checked before every in-app navigation.
     * Also registers a `beforeunload` handler so the browser prompts on tab close/refresh
     * when the guard returns non-true.
     */
    static setNavigationGuard(guardFn: NavigationGuardFn): void;
    /**
     * Removes the active navigation guard and its `beforeunload` handler.
     */
    static clearNavigationGuard(): void;
    /**
     * Returns `true` when `path` points outside the SPA -- http(s), protocol-relative,
     * `mailto:`, or `tel:` URLs. Used by {@link LinkButton} and available to app code.
     */
    static isExternalUrl(path: string): boolean;
    /** Current route path derived from `location.hash`. Returns `"/"` for the home route. */
    static get location(): string;
    /** Full browser URL including protocol, host, path, query, and hash. */
    static get absoluteURI(): string;
    /** SharePoint site collection absolute URL from `_spPageContextInfo`. */
    static get siteRootPath(): string;
    /** Browser URL up to (but excluding) the query string and hash. */
    static get pageRootPath(): string;
    /** Current URL search parameters (the `?key=value` portion before the hash). */
    static get queryParams(): URLSearchParams;
    /**
     * Creates and initialises the singleton Router.
     *
     * The home route (`"/"`) is always registered automatically. Unregistered paths
     * render a 404 page (built-in with 8-second redirect, or custom via `notFoundRoute`).
     * On construction the Router renders the route matching the current URL hash, then
     * begins listening for popstate events (browser back/forward).
     *
     * Subsequent calls with the same or different arguments return the existing instance
     * without reinitialising.
     *
     * @param routeRelativePaths - Route paths to register (e.g. `["dashboard", "users/list"]`).
     * @param props - Optional configuration for the container element and error boundary.
     */
    constructor(routeRelativePaths: RoutePaths, props?: RouterProps);
    /**
     * Resolves the optional 404 and 403 routes and performs the first navigation.
     *
     * Must be called after the singleton is assigned so that `_refreshCurrentPage`
     * can use `Router._runtimeInstance`.
     */
    private _initialize;
    /**
     * Creates the built-in 404 route with an 8-second auto-redirect to home.
     * Used when no custom `notFoundRoute` is provided.
     */
    private _createDefaultNotFoundRoute;
    /**
     * Creates the built-in 403 route with a generic access denied message.
     * Used when no custom `unauthorizedRoute` is provided.
     * Unlike the 404 page, there is no redirect timer -- unauthorized is a terminal state.
     */
    private _createDefaultUnauthorizedRoute;
    [Symbol.toStringTag](): string;
    /**
     * Converts a route path to its absolute file URL via {@link resolvePath}.
     * Maps `"/"` to `@/routes/route.js` and `"foo/bar"` to `@/routes/foo/bar/route.js`.
     */
    private _resolveRouteAbsolutePath;
    /** Registers a `popstate` listener so browser back/forward triggers a page refresh. */
    private _addPopStateEventListeners;
    /**
     * Unbinds all jQuery event handlers inside the container and clears its HTML.
     * Called before every route transition to prevent handler leaks from the previous route.
     */
    private _cleanup;
    /**
     * Re-renders the route that matches the current URL hash.
     *
     * Uses `replace = true` so that `history.replaceState` is called instead of
     * `pushState`. This is critical for two callers:
     * - **Constructor** -- the URL is already in the address bar on initial load.
     * - **popstate listener** -- the browser already updated the URL before firing the event.
     *
     * Without `replace`, each call would push a duplicate history entry.
     */
    private _refreshCurrentPage;
    /**
     * Configures a freshly imported {@link Route} with its container selector,
     * CSS class name, and route-specific stylesheet path, then caches it in `#routesMap`.
     */
    private _addImportedRoute;
    /**
     * Returns the cached {@link Route} for `path`, or lazy-loads it via dynamic `import()`.
     *
     * On first load the route module must default-export a {@link Route} instance.
     * Once loaded, the route is cached in `#routesMap` for all future navigations.
     *
     * @throws {SystemError} If the path is not registered (and no `notFoundRoute` is configured) or the module does not default-export a Route.
     */
    private _loadRoute;
    /** Serialises a key-value record into a `?key=value&` query string. */
    private _parseQueryParamsToString;
    /**
     * Core navigation routine. Loads the target route, tears down the current one, and
     * renders the new one.
     *
     * Uses `#navigationId` as a monotonic counter to detect stale navigations: if a newer
     * `_navigateTo` call runs while this one is awaiting `_loadRoute`, the stale call
     * bails out silently. This prevents a slow route import from overwriting a faster
     * subsequent navigation.
     *
     * Tracks the last rendered path in `#lastPath` so that `fromPath` remains accurate
     * even when the browser has already updated the URL before this method runs (e.g.
     * during popstate).
     *
     * @param path - Raw route path (absolute or relative).
     * @param options - Query parameters and new-tab flag.
     * @param replace - When `true`, uses `history.replaceState` instead of `pushState`.
     *   Used by {@link _refreshCurrentPage} to avoid duplicate history entries.
     */
    private _navigateTo;
    /**
     * Sets the document title and renders the given route into the container.
     * @throws {SystemError} If the route's `render()` call throws.
     */
    protected _applyRoute(route: Route): void;
    /**
     * Navigates up `x` segments in the current URL path.
     *
     * Unlike {@link Router.goBack | goBack}, which follows browser history order,
     * `popLevel` operates on the URL structure itself.
     *
     * @param x - Number of segments to remove from the end. Defaults to `1`.
     *
     * @example
     * ```ts
     * // Router.location === "sites/MySite/subpage/detail"
     * Router.popLevel();  // navigates to "sites/MySite/subpage"
     * Router.popLevel(2); // navigates to "sites/MySite"
     * ```
     */
    private _popLevel;
    /**
     * Evaluates the active navigation guard, if any.
     * Returns `true` when navigation should proceed, `false` when it should be blocked.
     */
    private _checkNavigationGuard;
    /**
     * Shows a navigation guard confirmation Dialog.
     * Resolves `true` if the user chooses to leave, `false` to stay.
     */
    private _showNavigationGuardDialog;
}

interface LinkButtonProps extends ButtonProps {
    disableOnOwnPath?: boolean;
    navigationOptions?: NavigationOptions;
    /** HTML target attribute for external links. Defaults to "_blank" for external URLs, ignored for internal routes. */
    target?: string;
}
declare class LinkButton extends Button {
    private _path;
    private _cleanupEventListener?;
    private _disableOnOwnPath;
    private _isExternal;
    private _target?;
    constructor(children: HTMDNode, path: string, props?: LinkButtonProps);
    private _onNavigationHandler;
    remove(): void;
    protected _applyEventListeners(): void;
    toString(): string;
    get isExternal(): boolean;
    get path(): string;
}

interface TextProps extends HTMDElementProps {
    type?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'label' | 'p' | 'span';
    for?: string;
    title?: string;
}
declare class Text extends HTMDElement {
    type: TextProps['type'];
    for: string;
    title: string;
    constructor(children?: HTMDNode, props?: TextProps);
    toString(): string;
}

type pageResetOptions = {
    /**
     * Boolean flag that indicates if the console should be cleared once this function executes,
     */
    clearConsole: boolean;
    /**
     * Boolean flag that indicates if the script should remove all style and link tags that load css
     */
    removeStyles: boolean;
    /**
     * Optional path to a client/app theme CSS file.
     * Loaded AFTER the base SPARC theme, overriding tokens and adding custom styles.
     */
    themePath?: string;
    __INTERNAL_DEBUG_OPTIONS?: __INTERNAL_DEBUG_OPTIONS;
};
type __INTERNAL_DEBUG_OPTIONS = {
    stopAutoRefreshDigest: boolean;
    stopAutoLoadBaseTheme: boolean;
};
/**
 * A function that hides all the sharepoint UI and prepends a div#page element to act as a wrapper.
 * Once this function is called, another one becomes globally available to show the UI.
 * @param {pageResetOptions} options refer to the pageResetOptions type for more docs
 *
 * @see displaySharePointUI - to show SP's ui back again.
 */
declare function pageReset({ clearConsole, removeStyles, themePath, __INTERNAL_DEBUG_OPTIONS, }?: pageResetOptions): Promise<void>;

declare class SimpleElapsedTimeBenchmark {
    private _start;
    private _end;
    private _elapsed;
    constructor();
    start(): void;
    private _calcElapsedTime;
    stop(): void;
    get elapsed(): number;
}

interface ErrorOptions {
    breaksFlow?: boolean;
}
declare class SystemError extends Error {
    private _name;
    private _timestamp;
    private _breaksFlow;
    constructor(name: string, message: string, options?: ErrorOptions);
    static fromErrorEvent(event: ErrorEvent, options?: ErrorOptions): SystemError;
    get timestamp(): Date;
    get name(): string;
    get breaksFlow(): boolean;
    toString(): string;
    toJSON(): string;
}

interface ErrorBoundaryProps {
    target?: Window | HTMLElement;
    onErrorCallback?: (error: ErrorEvent) => void;
    onAsyncErrorCallback?: (error: PromiseRejectionEvent) => void;
    name?: string;
}
declare class ErrorBoundary {
    protected _targetElement: Window | HTMLElement;
    protected _onErrorCallback?: (error: ErrorEvent) => void;
    protected _onAsyncErrorCallback?: (error: PromiseRejectionEvent) => void;
    protected _name: string;
    constructor(props: ErrorBoundaryProps);
    protected _displayError(error: SystemError): Promise<void>;
    protected _parseEventData(event: Event): SystemError;
    private _onErrorEventHandler;
    private _onAsyncErrorEventHandler;
    private _addEventListeners;
}

interface RuntimeEventOptions {
    bubbles?: boolean;
    cancelable?: boolean;
}
interface RuntimeEventListenerOptions {
    once?: boolean;
}
declare abstract class RuntimeEvent extends Event {
    protected _target: EventTarget;
    constructor(eventTarget: EventTarget, options?: RuntimeEventOptions);
    protected static _createListener<E extends Event>(eventName: string, callback: (e?: E) => void, target: EventTarget, options?: RuntimeEventListenerOptions): () => void;
    dispatch(): boolean;
    get target(): EventTarget;
}

/**
 * Dispatched on `window` after a route transition completes.
 *
 * This is a post-navigation event -- by the time listeners receive it, the URL has been
 * updated and the new route is rendered. It cannot be cancelled or intercepted.
 *
 * @example
 * ```ts
 * // Subscribe -- returns a cleanup function
 * const cleanup = NavigationEvent.listener((e) => {
 *   console.log(`Navigated from ${e?.from} to ${e?.to}`);
 * });
 *
 * // Unsubscribe -- MUST be called before re-registering or on component removal
 * cleanup();
 * ```
 */
declare class NavigationEvent extends RuntimeEvent {
    #private;
    constructor(to: string, from?: string, query?: Record<string, string>);
    /**
     * Registers a listener for navigation events on `window`.
     *
     * Returns a cleanup function that removes the listener. When registering inside a
     * render/refresh cycle, always call the previous cleanup function first to avoid
     * duplicate listeners:
     *
     * @example
     * ```ts
     * private _cleanup?: () => void;
     *
     * onRender() {
     *   this._cleanup?.();  // remove previous listener before creating a new one
     *   this._cleanup = NavigationEvent.listener((e) => { ... });
     * }
     *
     * remove() {
     *   this._cleanup?.();
     *   super.remove();
     * }
     * ```
     */
    static listener(callback: (event?: NavigationEvent) => void, options?: RuntimeEventListenerOptions): () => void;
    /** Route path that was navigated to. */
    get to(): string;
    /** Route path that was navigated away from. Undefined on initial load. */
    get from(): string | undefined;
    /** Query parameters passed with the navigation, if any. */
    get query(): Record<string, string> | undefined;
}

interface RouteConfig {
    setRouteTitle: (title: string) => void;
    $DANGEROUS__route_backdoor: Route;
}
declare function defineRoute(closureCallback: (config: RouteConfig) => Promise<HTMDNode> | HTMDNode): Promise<Route>;

/**
 * SharePoint field value serialization utilities.
 *
 * SharePoint stores all list item values as strings. These utilities handle
 * the conversion between JavaScript types and SharePoint's string storage:
 *
 * - `toFieldValue` -- serialize JS values for writes (createItem, updateItem)
 * - `fromFieldValue` -- manual parse utility for explicit type conversion
 * - `parseFieldValues` -- auto-parse all fields on read (used internally by ListApi)
 */

type SPSimpleValue = string | number | boolean;
type SPFieldValue = SPSimpleValue | SPSimpleValue[] | Record<string, unknown> | Record<string, unknown>[];
/**
 * Duck-type check for ComboBoxOptionProps.
 *
 * Returns true if the value is a non-null object with a string `label` property
 * and a `value` property. Uses duck typing to avoid coupling fieldValue to the
 * DOM component layer.
 */
declare function isComboBoxOption(value: unknown): value is {
    label: string;
    value: unknown;
};
/**
 * Extract the storable value from a FormField value that may contain
 * ComboBoxOptionProps objects.
 *
 * - Single ComboBoxOptionProps: returns `option.value`
 * - Array of ComboBoxOptionProps: returns array of extracted `.value` entries
 * - Non-ComboBox values (string, number, boolean): passed through unchanged
 */
declare function extractComboBoxValue(value: FormFieldType): SPFieldValue;
/**
 * Serialize a JavaScript value for SharePoint storage.
 *
 * - `string` -- returned as-is
 * - `number`, `boolean` -- converted via `String(value)`
 * - Arrays and objects -- converted via `JSON.stringify(value)`
 */
declare function toFieldValue(value: SPFieldValue): string;
/**
 * Parse a raw SharePoint string value into a typed JavaScript value.
 *
 * Attempts `JSON.parse` first; falls back to the raw string on failure.
 * Returns `null` for null, undefined, or empty string input.
 *
 * The developer provides the expected type via the generic parameter.
 */
declare function fromFieldValue<T>(raw: string): T | null;

interface CAMLQueryResponse<T> {
    value: T[];
    ListItemCollectionPosition: {
        PagingInfo: string;
    } | null;
}
type SPCollectionResponse<T> = {
    value: T[];
};
/** odata.etag field present on items returned with minimalmetadata Accept header. */
interface SPItemWithETag {
    'odata.etag': string;
}

/** All CAML comparison operators supported by the query builder. */
type CAMLOperator = 'Eq' | 'Neq' | 'Gt' | 'Lt' | 'Geq' | 'Leq' | 'Contains' | 'BeginsWith' | 'IsNull' | 'IsNotNull' | 'Or';
/** Operators that compare a field against a typed value. */
type CAMLValueOperator = 'Eq' | 'Neq' | 'Gt' | 'Lt' | 'Geq' | 'Leq' | 'Contains' | 'BeginsWith';
/**
 * A single field condition in a CAML query.
 *
 * - `string` -- shorthand for exact match (`Eq` operator)
 * - `{ value, operator }` -- explicit operator with a single value
 * - `{ value: string[], operator: 'Or', match? }` -- same-field multi-value OR
 *
 * @example
 * // Exact match (string shorthand):
 * "Hello"
 *
 * // Explicit operator:
 * { value: "30", operator: "Gt" }
 *
 * // Null check (no value needed):
 * { value: "", operator: "IsNull" }
 *
 * // Same-field multi-value OR (default match: Eq):
 * { value: ["Active", "Pending"], operator: "Or" }
 *
 * // Same-field multi-value OR with custom match operator:
 * { value: ["80", "90"], operator: "Or", match: "Geq" }
 */
type CAMLCondition = string | {
    value: string;
    operator: CAMLValueOperator;
} | {
    value: string;
    operator: 'IsNull' | 'IsNotNull';
} | {
    value: string[];
    operator: 'Or';
    match?: CAMLValueOperator;
};
/**
 * Object representation of a CAML query for `ListApi.getItems()`.
 *
 * Field entries are AND-ed together. The optional `$or` key accepts an array
 * of query objects whose results are OR-ed, enabling cross-field OR logic.
 * Nesting depth for `$or` is limited to 2 levels.
 *
 * All variants are fully backwards compatible -- passing a plain
 * `Record<string, string>` still works as before (exact Eq match).
 *
 * @example
 * // Exact match (backwards compatible):
 * { Title: "Hello" }
 *
 * // Explicit operator:
 * { Age: { value: "30", operator: "Gt" } }
 *
 * // Null check:
 * { Email: { value: "", operator: "IsNull" } }
 *
 * // Same-field multi-value OR:
 * { Status: { value: ["Active", "Pending"], operator: "Or" } }
 *
 * // Multi-value OR with custom match operator:
 * { Score: { value: ["80", "90"], operator: "Or", match: "Geq" } }
 *
 * // Cross-field OR:
 * { $or: [{ Department: "HR" }, { Department: "IT" }] }
 *
 * // Combined -- field conditions AND-ed, cross-field OR separately:
 * { Status: "Active", $or: [{ Dept: "HR" }, { Dept: "IT" }] }
 */
type CAMLQueryObject = Record<string, CAMLCondition> & {
    $or?: CAMLQueryObject[];
};
interface CAMLOrderByField {
    field: string;
    ascending?: boolean;
}

interface SPList {
    Id: string;
    Title: string;
    Description: string;
    ItemCount: number;
    Hidden: boolean;
    BaseTemplate: number;
    BaseType: number;
    Created: string;
    LastItemModifiedDate: string;
    ServerRelativeUrl: string;
    EntityTypeName: string;
    ParentWebUrl: string;
    EnableAttachments: boolean;
    EnableVersioning: boolean;
}
interface SPWeb {
    Id: string;
    Title: string;
    Description: string;
    Url: string;
    ServerRelativeUrl: string;
    Language: number;
    WebTemplate: string;
    Created: string;
    LastItemModifiedDate: string;
}
interface SPField {
    Id: string;
    Title: string;
    InternalName: string;
    TypeAsString: string;
    FieldTypeKind: number;
    Required: boolean;
    Description: string;
    DefaultValue: string | null;
    Hidden: boolean;
    ReadOnlyField: boolean;
    Indexed: boolean;
}

interface CreateFieldOptions {
    title: string;
    /** When true, creates a Note (multiline text) field. Defaults to single-line Text. */
    multiline?: boolean;
    indexed?: boolean;
}
interface ListApiOptions {
    listItemType?: string;
    siteApi?: SiteApi;
}
interface GetItemsOptions {
    /** Maximum total items to return across all pages. Defaults to all items. */
    limit?: number;
    /** Sort fields. Each entry specifies a field name and optional ascending direction (default: true). */
    orderBy?: CAMLOrderByField[];
    /** Restrict which fields are returned. Maps to CAML ViewFields. */
    viewFields?: string[];
}
interface GetItemsPagedOptions extends GetItemsOptions {
    /** Items per page (CAML RowLimit). Defaults to 500. Must be a positive integer. */
    pageSize?: number;
}
interface PaginatedResult<T> {
    /** Items in the current page (already parsed via parseFieldValues). */
    items: (T & SPItemWithETag)[];
    /** Fetch the next page. Null when no more pages or limit reached. */
    next: (() => Promise<PaginatedResult<T>>) | null;
}
declare class ListApi {
    #private;
    protected _siteApi: SiteApi;
    constructor(title: string, options?: ListApiOptions);
    private _validateAndSerializeFields;
    private _validateItemId;
    private _validateETag;
    private _validateNonEmptyString;
    private _buildAndClause;
    private _buildOrClause;
    private _validateQueryObject;
    private _validateCondition;
    private _parseCondition;
    private _buildWhereContent;
    private _buildViewXml;
    protected _parseCAMLQueryObject(args: CAMLQueryObject, options?: GetItemsOptions, rowLimit?: number): string;
    protected _createCAMLQueryPayload(camlQuery: string, pagingInfo?: string | null): {
        query: Record<string, unknown>;
    };
    private _normalizeCAMLResponse;
    protected _queryRequest<T>(args: CAMLQueryObject | string | undefined, options?: GetItemsOptions): Promise<(T & SPItemWithETag)[]>;
    getItems<T>(query?: CAMLQueryObject | string, options?: GetItemsOptions): Promise<(T & SPItemWithETag)[]>;
    getItemsPaged<T>(query?: CAMLQueryObject | string, options?: GetItemsPagedOptions): Promise<PaginatedResult<T>>;
    getItemByTitle<T>(title: string): Promise<(T & SPItemWithETag)[]>;
    getItemByUUID<T>(uuid: string): Promise<(T & SPItemWithETag)[]>;
    getOwnedItems<T>(userId?: string): Promise<(T & SPItemWithETag)[]>;
    createItem(item: Record<string, SPFieldValue>): Promise<unknown>;
    deleteItem(id: number, etag: string): Promise<unknown>;
    deleteALLItems(): Promise<void>;
    updateItem(id: number, fields: Record<string, SPFieldValue>, etag: string): Promise<unknown>;
    getFields(): Promise<SPField[]>;
    createField(options: CreateFieldOptions): Promise<SPField>;
    deleteField(internalName: string): Promise<void>;
    setFieldIndexed(internalName: string, indexed: boolean): Promise<void>;
    get endpoint(): string;
    get listItemType(): string;
}
/**
 * Strips null/undefined entries from a query fields object before passing
 * it to `ListApi.getItems()`. Useful when building queries from optional
 * filter values -- avoids manually checking each field before constructing
 * the query object.
 *
 * For `Or` conditions, null/undefined entries are removed from the value
 * array. If all values are filtered out, the entire field is omitted.
 *
 * @returns A cleaned `CAMLQueryObject`, or `undefined` if no conditions remain.
 */
/** Input type for sanitizeQuery -- mirrors CAMLQueryObject but allows nullable values. */
type SanitizeQueryInput = Record<string, CAMLCondition | null | undefined> & {
    $or?: SanitizeQueryInput[];
};
declare function sanitizeQuery(fields: SanitizeQueryInput): CAMLQueryObject | undefined;

interface CreateListOptions {
    description?: string;
    /** SharePoint BaseTemplate ID. Default: 100 (Generic List). */
    template?: number;
}
declare class SiteApi {
    #private;
    constructor(absoluteUrl?: string);
    /**
     * Returns a cached {@link ListApi} instance for the given list title, creating
     * one on first access.
     *
     * @param title - The SharePoint list title.
     * @param options - Optional {@link ListApiOptions} (excluding `siteApi`, which is
     *   injected automatically).
     */
    list(title: string, options?: Omit<ListApiOptions, 'siteApi'>): ListApi;
    /**
     * Retrieves consolidated user details from multiple SharePoint endpoints.
     *
     * Delegates to the standalone {@link getFullUserDetails} function, passing this
     * instance as the site context.
     *
     * @param loginName - The user's login name (claims-encoded or plain DOMAIN\\user).
     * @returns A consolidated {@link FullUserDetails} object.
     */
    getFullUserDetails(loginName: string): Promise<FullUserDetails>;
    /**
     * Returns a valid request digest token for this site.
     *
     * - **Local site** (`url` matches `_spPageContextInfo.webAbsoluteUrl`): reads the
     *   token directly from the `#__REQUESTDIGEST` DOM element. This is instant and
     *   does not make an API call -- SharePoint manages local token refresh
     *   automatically.
     *
     * - **Remote site**: delegates to {@link refreshRequestDigest}, which handles
     *   caching, expiry, and in-flight coalescing for the remote site URL.
     *
     * @returns A Promise resolving with the digest token string.
     */
    getRequestDigest(): Promise<string>;
    /**
     * Retrieves all lists on this site.
     *
     * Calls `/_api/web/lists` and returns the collection of {@link SPList} objects.
     *
     * @returns A Promise resolving with an array of {@link SPList}.
     */
    getLists(): Promise<SPList[]>;
    /**
     * Retrieves all site groups on this site.
     *
     * Calls `/_api/web/sitegroups` and returns the collection of {@link SPGroup} objects.
     *
     * @returns A Promise resolving with an array of {@link SPGroup}.
     */
    getSiteGroups(): Promise<SPGroup[]>;
    /**
     * Retrieves all users belonging to the given site group, filtering out ghost
     * entries with empty/invalid email addresses and deduplicating by normalized
     * email (keeping the row with the richer `Title` when duplicates exist).
     *
     * On-premises SharePoint can create a stale "ghost" principal alongside the
     * valid one for each AD user -- the ghost has an empty `Email` column. This
     * method drops those rows so callers never see phantom options in pickers.
     *
     * Accepts either a numeric group ID or a group name (title string).
     * Calls `/_api/web/sitegroups/getbyid(n)/users` or
     * `/_api/web/sitegroups/getbyname('name')/users` accordingly.
     *
     * The returned `Title` and `Email` reflect SharePoint's User Information List
     * (a cached snapshot) and may lag AD changes until the user next logs in or a
     * profile sync runs.
     *
     * Pass `{ enrich: true }` to resolve each member's live profile via
     * {@link getUserProfile}, merging the result with the cached {@link SPUser} data.
     * This makes one extra HTTP call per group member.
     *
     * @param group - Numeric group ID or group name string.
     * @param options - Optional `{ enrich: true }` to fetch live profiles.
     * @returns An array of {@link SPUser}, or `SPUser & UserProfile` when enriched.
     */
    getGroupUsers(group: number | string, options?: {
        enrich?: false;
    }): Promise<SPUser[]>;
    getGroupUsers(group: number | string, options: {
        enrich: true;
    }): Promise<(SPUser & UserProfile)[]>;
    /**
     * Returns the subset of a group's members whose `Email` equals `email`,
     * filtered **server-side** via OData `$filter`.
     *
     * This is the preferred membership check for on-premises SharePoint because
     * the `sitegroups/.../users` list can contain duplicate UIL entries for the
     * same AD account (one valid, one ghost with an empty email). Matching on the
     * stable `Email` column via a server-side filter avoids fetching the full
     * membership list and sidesteps numeric site-user-ID ambiguity.
     *
     * @param group - Numeric group ID or group name string.
     * @param email - The email to test membership for (any case/whitespace).
     * @returns An array of {@link SPUser} rows that matched (empty = not a member).
     */
    getGroupUsersByEmail(group: number | string, email: string): Promise<SPUser[]>;
    /**
     * Returns `true` when the user identified by `email` is a member of the
     * given group, determined via a server-side OData email filter.
     *
     * @param group - Numeric group ID or group name string.
     * @param email - The user's email address.
     */
    isUserInGroup(group: number | string, email: string): Promise<boolean>;
    /**
     * Retrieves the web properties for this site.
     *
     * Calls `/_api/web` and returns the {@link SPWeb} object directly.
     *
     * @returns A Promise resolving with the {@link SPWeb} properties.
     */
    getWebInfo(): Promise<SPWeb>;
    private _validateTitle;
    /**
     * Creates a new SharePoint list and returns a cached {@link ListApi} instance
     * for immediate use.
     *
     * @param title - The display title for the new list.
     * @param options - Optional {@link CreateListOptions} for description and base template.
     * @returns A {@link ListApi} instance bound to the newly created list.
     */
    createList(title: string, options?: CreateListOptions): Promise<ListApi>;
    /**
     * Deletes a SharePoint list by title and removes it from the internal cache.
     *
     * @param title - The display title of the list to delete.
     */
    deleteList(title: string): Promise<void>;
    get url(): string;
}

/**
 * Searches Active Directory for users matching the given query string.
 *
 * Uses the `clientPeoplePickerSearchUser` endpoint which performs a farm-wide
 * search against all configured identity providers. Reads
 * `_spPageContextInfo.webAbsoluteUrl` for the endpoint URL; the request digest
 * is auto-injected by {@link spPOST}.
 *
 * By default, results are normalized: unresolved phantom entries are dropped,
 * `MultipleMatches` arrays are flattened into the top-level list, and duplicate
 * entries for the same user (different auth providers) are deduped keeping the
 * richest entry (most populated `EntityData`). Pass `options.raw: true` to
 * skip normalization and receive the raw SharePoint response.
 *
 * @param query - The search string (name, email, or login name).
 * @param options - Optional search configuration. See {@link PeopleSearchOptions}.
 * @returns An array of matching {@link PeopleSearchResult} entries.
 */
declare function searchUsers(query: string, options?: PeopleSearchOptions): Promise<PeopleSearchResult[]>;
/**
 * Retrieves the user profile from PeopleManager (farm-wide, no site context needed).
 *
 * Accepts a claims login name (e.g. `"i:0#.w|DOMAIN\\user"`) or a plain
 * `DOMAIN\\user` string. If the input lacks a claims prefix, the function
 * resolves the full claims identity via people picker search.
 *
 * @param loginName - The user's login name (claims-encoded or plain DOMAIN\\user).
 * @returns A {@link UserProfile} object with profile data.
 * @throws When the profile cannot be fetched.
 */
declare function getUserProfile(loginName: string): Promise<UserProfile>;
/**
 * Retrieves consolidated user details from multiple SharePoint endpoints.
 *
 * Site-scoped -- requires a {@link SiteApi} instance for cross-site digest
 * management and endpoint resolution.
 *
 * Accepts a claims login name (e.g. `"i:0#.w|DOMAIN\\user"`) or a plain
 * `DOMAIN\\user` string. If the input lacks a claims prefix, the function
 * resolves the full claims identity via people picker search.
 *
 * The pipeline calls four endpoints (three in parallel, one sequential):
 * 1. `ensureUser` (POST) -- registers the user on the site, returns site-level
 *    ID. Required -- throws if it fails.
 * 2. `PeopleManager/GetPropertiesFor` (GET) -- returns full user profile from
 *    UPS (farm-wide). Run in parallel with steps 1 and 4; fault-tolerant.
 * 3. `getuserbyid/groups` (GET) -- returns SharePoint group memberships. Runs
 *    after step 1 (needs site user ID); fault-tolerant.
 * 4. `clientPeoplePickerSearchUser` (POST) -- resolves picker-canonical email
 *    and display name via {@link _resolvePickerIdentity}. Run in parallel with
 *    steps 1 and 2; fault-tolerant (returns null on failure).
 *
 * **Email and display name preference:**
 * The People Picker's `EntityData.Email` and `DisplayText` are used as the
 * authoritative values for `email` and `displayName` respectively. This
 * guarantees byte-identical matches with what {@link searchUsers} returns,
 * which is important in orgs where a user has multiple AD accounts and the
 * picker email is the canonical lookup key. Fallback chain:
 * - `displayName`: picker DisplayText > UPS DisplayName > ensureUser Title
 * - `email`:       picker EntityData.Email > UPS Email > ensureUser Email
 *
 * Steps 2, 3, and 4 are fault-tolerant: if any fails, the corresponding
 * fields are populated with empty defaults rather than aborting the entire call.
 *
 * @param loginName - The user's login name (claims-encoded or plain DOMAIN\\user).
 * @param siteApi - A {@link SiteApi} instance for site-scoped operations.
 * @returns A consolidated {@link FullUserDetails} object.
 * @throws When `ensureUser` fails (user cannot be resolved on the site).
 */
declare function getFullUserDetails(loginName: string, siteApi?: SiteApi): Promise<FullUserDetails>;

/**
 * Augments a {@link SystemError} with optional contextual properties that
 * the email API attaches after construction. Because {@link SystemError} does not
 * accept arbitrary properties in its `options` object, `cause` and `details`
 * are assigned as instance properties and typed via this intersection.
 */
interface SystemErrorEmailAugment {
    /** The original error that triggered this {@link SystemError}, if any. */
    cause?: unknown;
    /** Structured context object for diagnostics (e.g. invalid addresses, counts). */
    details?: unknown;
}
/** A {@link SystemError} with optional `cause` and `details` properties. */
type AugmentedSystemError = SystemError & SystemErrorEmailAugment;
/**
 * Arguments accepted by {@link sendEmail}.
 *
 * Recipients may be provided as a single string or an array of strings.
 * All addresses are normalized (trimmed, lower-cased, deduped) before use.
 */
interface SendEmailArgs {
    /**
     * One or more recipient email addresses (required).
     * At least one of `to`, `cc`, or `bcc` must resolve to a non-empty list.
     */
    to: string | string[];
    /** Optional Cc email addresses. */
    cc?: string | string[];
    /** Optional Bcc email addresses. */
    bcc?: string | string[];
    /** Non-empty email subject (required). */
    subject: string;
    /** Non-empty email body, HTML or plain text (required). */
    body: string;
    /**
     * Optional From address. When omitted, SharePoint uses the web application's
     * configured outbound email account.
     */
    from?: string;
}
/**
 * Successful result returned by {@link sendEmail}.
 */
interface SendEmailResult {
    /** Always `true` on success. */
    ok: true;
    /** Total number of unique recipients across To, Cc, and Bcc. */
    recipientCount: number;
}
/**
 * Result returned by {@link resolveEmailsToLogins}.
 *
 * The three fields are mutually exclusive: each input email ends up in exactly
 * one of `resolved`, `unresolved`, or `invalid`.
 */
interface ResolveEmailsResult {
    /**
     * Map from normalized email address to SharePoint claim login name
     * for every email that was found in the site's User Information List.
     */
    resolved: Map<string, string>;
    /**
     * Emails that passed format validation but were not found in the site UIL.
     * Each user must have visited or been granted access to this site collection
     * before they appear in the UIL.
     */
    unresolved: string[];
    /** Emails that failed basic format validation (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). */
    invalid: string[];
}
/** Shape of a single row returned by the siteUsers OData query. */
interface SiteUserRow {
    Email: string;
    LoginName: string;
}

/**
 * Maximum number of unique recipients (To + Cc + Bcc combined) per {@link sendEmail}
 * call. Callers must split larger audiences into chunks of this size and call
 * `sendEmail` once per chunk.
 */
declare const MAX_RECIPIENTS_PER_CALL = 50;
/**
 * Resolves a list of email addresses to their SharePoint claim login names
 * via the current site's User Information List.
 *
 * Performs a single OR-filtered `siteUsers` query. Resolution-by-email bypasses
 * UPS / People Picker, which has been observed to fail on some sites where SP
 * cannot match UIL.Email column values reliably. Login-name lookups always
 * work if the user is in the UIL.
 *
 * @param emails - Email addresses (any case, leading/trailing whitespace OK).
 * @returns Resolved map, unresolved list, and invalid list. See {@link ResolveEmailsResult}.
 * @throws {SystemError} `'EmailResolutionFailed'` (`breaksFlow=false`) if the
 *   `siteUsers` query fails.
 */
declare function resolveEmailsToLogins(emails: string[]): Promise<ResolveEmailsResult>;
/**
 * Sends an email via `SP.Utilities.Utility.SendEmail`.
 *
 * Pipeline:
 *   1. Validate args (subject, body, recipient presence)
 *   2. Normalize, dedupe, and cap-check recipients across To/Cc/Bcc
 *   3. Resolve every recipient to a claim login (single REST call via {@link resolveEmailsToLogins})
 *   4. `ensureUser` fallback for any misses (one POST per missing recipient, sequential;
 *      users unresolvable by SharePoint's People Picker remain in the unresolved list)
 *   5. POST a single `SendEmail` request
 *
 * Cap: {@link MAX_RECIPIENTS_PER_CALL}. Larger audiences must be chunked by the
 * caller -- one `sendEmail` call per chunk.
 *
 * @param args - See {@link SendEmailArgs}.
 * @returns `{ ok: true, recipientCount }` on success. See {@link SendEmailResult}.
 * @throws {SystemError}
 *   - `'EmailValidation'`        (`breaksFlow=true`)  -- bad/missing args; programmer error.
 *   - `'EmailTooManyRecipients'` (`breaksFlow=false`) -- count exceeds {@link MAX_RECIPIENTS_PER_CALL}.
 *   - `'EmailInvalid'`           (`breaksFlow=false`) -- malformed addresses present.
 *   - `'EmailUnresolved'`        (`breaksFlow=false`) -- recipients not in site UIL even after `ensureUser` fallback.
 *   - `'EmailResolutionFailed'`  (`breaksFlow=false`) -- `siteUsers` query failed.
 *   - `'EmailSendFailed'`        (`breaksFlow=false`) -- `SendEmail` POST rejected.
 */
declare function sendEmail({ to, cc, bcc, subject, body, from, }: SendEmailArgs): Promise<SendEmailResult>;

/**
 * Options for SharePoint REST API request functions.
 *
 * Extends jQuery's `JQueryAjaxSettings` with an optional `requestDigest` field
 * for write operations (POST, DELETE, MERGE). When omitted on write requests,
 * the token is read from the `#__REQUESTDIGEST` DOM hidden field automatically.
 *
 * @see {@link https://api.jquery.com/jQuery.ajax/} for the full JQueryAjaxSettings spec.
 */
interface SPRequestOptions extends JQueryAjaxSettings {
    /**
     * SharePoint request digest token for write operations.
     *
     * When provided, this value is injected as the `X-RequestDigest` header
     * on POST, DELETE, and MERGE requests. When omitted, the current token
     * is read from the `#__REQUESTDIGEST` DOM hidden field.
     *
     * Typically obtained from {@link SiteApi.requestDigest}.
     */
    requestDigest?: string;
}
/** Accept header for SharePoint responses with minimal OData metadata (includes etags). */
declare const SP_ACCEPT_MINIMAL = "application/json;odata=minimalmetadata";
/**
 * Sends a GET request to a SharePoint REST API endpoint.
 *
 * Sets the following default headers (overridable via `options.headers`):
 * - `accept: application/json;odata=minimalmetadata`
 *
 * Sets the following default AJAX settings (overridable via `options`):
 * - `async: true`
 * - `dataType: "json"`
 *
 * @typeParam T - The expected shape of the response data.
 *
 * @param url - The full REST API endpoint URL
 *   (e.g., `"/_api/web/lists/getbytitle('Tasks')/items"`).
 * @param options - Optional {@link SPRequestOptions}.
 *
 * @returns `Promise<T>` in async mode, or `T` directly when `options.async` is `false`.
 *
 * @throws {SystemError} Propagated from {@link baseRequest} on request failure.
 *
 * @example
 * ```ts
 * // Async usage
 * const data = await spGET<Item[]>(
 *   "/_api/web/lists/getbytitle('Tasks')/items"
 * );
 * ```
 */
/** @deprecated Synchronous requests block the main thread and skip digest auto-retry. Use the async overload instead. */
declare function spGET<T>(url: string, options: SPRequestOptions & {
    async: false;
}): T;
declare function spGET<T>(url: string, options?: SPRequestOptions): Promise<T>;
/**
 * Sends a POST request to a SharePoint REST API endpoint for creating items.
 *
 * The `options.data` object is automatically serialized via `JSON.stringify()`.
 * The `X-RequestDigest` header is auto-injected from the `#__REQUESTDIGEST`
 * DOM hidden field when no explicit `requestDigest` is provided.
 *
 * Sets the following default headers (overridable via `options.headers`):
 * - `accept: application/json;odata=nometadata`
 * - `X-HTTP-Method: POST`
 * - `Content-Type: application/json;odata=verbose`
 *
 * Sets the following default AJAX settings (overridable via `options`):
 * - `async: true`
 * - `dataType: "json"`
 *
 * @typeParam T - The expected shape of the response data.
 *
 * @param url - The full REST API endpoint URL
 *   (e.g., `"/_api/web/lists/getbytitle('Tasks')/items"`).
 * @param options - Optional {@link SPRequestOptions}. The `data` field should contain
 *   the item payload (including `__metadata`).
 *
 * @returns `Promise<T>` in async mode, or `T` directly when `options.async` is `false`.
 *
 * @throws {SystemError} Propagated from {@link baseRequest} on request failure.
 *
 * @example
 * ```ts
 * const result = await spPOST("/_api/web/lists/getbytitle('Tasks')/items", {
 *   data: {
 *     __metadata: { type: "SP.Data.TasksListItem" },
 *     Title: "New Task",
 *   },
 * });
 * ```
 */
/** @deprecated Synchronous requests block the main thread and skip digest auto-retry. Use the async overload instead. */
declare function spPOST<T>(url: string, options: SPRequestOptions & {
    async: false;
}): T;
declare function spPOST<T>(url: string, options?: SPRequestOptions): Promise<T>;
/**
 * Sends a DELETE request to a SharePoint REST API endpoint.
 *
 * The actual HTTP method sent is `POST` with the `X-HTTP-Method: DELETE` header
 * override, as required by SharePoint's REST API. The `X-RequestDigest` header
 * is auto-injected from the `#__REQUESTDIGEST` DOM hidden field when no
 * explicit `requestDigest` is provided.
 *
 * The caller must provide an `IF-MATCH` header via `options.headers` with
 * either a specific ETag (for optimistic concurrency) or `"*"` (to skip
 * concurrency checks).
 *
 * Sets the following default headers (overridable via `options.headers`):
 * - `accept: application/json;odata=nometadata`
 * - `X-HTTP-Method: DELETE`
 * - `Content-Type: application/json;odata=verbose`
 *
 * Sets the following default AJAX settings (overridable via `options`):
 * - `async: true`
 *
 * Note: Unlike GET and POST, this function does NOT set a default `dataType`,
 * since DELETE responses from SharePoint typically return no body.
 *
 * @typeParam T - The expected shape of the response data (often `void` or unused).
 *
 * @param url - The full REST API endpoint URL, including the item ID
 *   (e.g., `"/_api/web/lists/getbytitle('Tasks')/items(42)"`).
 * @param options - Optional {@link SPRequestOptions}.
 *
 * @returns `Promise<T>` in async mode, or `T` directly when `options.async` is `false`.
 *
 * @throws {SystemError} Propagated from {@link baseRequest} on request failure.
 *
 * @example
 * ```ts
 * // Delete item with ID 42 using a specific ETag
 * await spDELETE("/_api/web/lists/getbytitle('Tasks')/items(42)", {
 *   headers: { 'IF-MATCH': '"1"' },
 * });
 * ```
 */
/** @deprecated Synchronous requests block the main thread and skip digest auto-retry. Use the async overload instead. */
declare function spDELETE<T>(url: string, options: SPRequestOptions & {
    async: false;
}): T;
declare function spDELETE<T>(url: string, options?: SPRequestOptions): Promise<T>;
/**
 * Sends a MERGE request to a SharePoint REST API endpoint for partial updates.
 *
 * Only the fields included in `options.data` are modified; other fields remain
 * unchanged. The `options.data` object is automatically serialized via
 * `JSON.stringify()`. The actual HTTP method sent is `POST` with the
 * `X-HTTP-Method: MERGE` header override, as required by SharePoint's REST API.
 * The `X-RequestDigest` header is auto-injected from the `#__REQUESTDIGEST`
 * DOM hidden field when no explicit `requestDigest` is provided.
 *
 * The caller must provide an `IF-MATCH` header via `options.headers` with
 * either a specific ETag (for optimistic concurrency) or `"*"` (to skip
 * concurrency checks).
 *
 * Sets the following default headers (overridable via `options.headers`):
 * - `accept: application/json;odata=nometadata`
 * - `X-HTTP-Method: MERGE`
 * - `Content-Type: application/json;odata=verbose`
 *
 * Sets the following default AJAX settings (overridable via `options`):
 * - `async: true`
 *
 * Note: Unlike GET and POST, this function does NOT set a default `dataType`,
 * since MERGE responses from SharePoint typically return no body (HTTP 204).
 *
 * @typeParam T - The expected shape of the response data (often `void` or unused).
 *
 * @param url - The full REST API endpoint URL, including the item ID
 *   (e.g., `"/_api/web/lists/getbytitle('Tasks')/items(42)"`).
 * @param options - Optional {@link SPRequestOptions}. The `data` field should contain
 *   the partial item payload (including `__metadata`).
 *
 * @returns `Promise<T>` in async mode, or `T` directly when `options.async` is `false`.
 *
 * @throws {SystemError} Propagated from {@link baseRequest} on request failure.
 *
 * @example
 * ```ts
 * // Update the Title of item 42 using a specific ETag
 * await spMERGE("/_api/web/lists/getbytitle('Tasks')/items(42)", {
 *   data: {
 *     __metadata: { type: "SP.Data.TasksListItem" },
 *     Title: "Updated Title",
 *   },
 *   headers: { 'IF-MATCH': '"1"' },
 * });
 * ```
 */
/** @deprecated Synchronous requests block the main thread and skip digest auto-retry. Use the async overload instead. */
declare function spMERGE<T>(url: string, options: SPRequestOptions & {
    async: false;
}): T;
declare function spMERGE<T>(url: string, options?: SPRequestOptions): Promise<T>;

/**
 * Fetches a fresh form digest token from SharePoint's `/_api/contextinfo` endpoint.
 *
 * Supports both local and remote sites:
 *
 * - **Local** (no `siteUrl`, or `siteUrl` matches `_spPageContextInfo.webAbsoluteUrl`):
 *   Fetches a new token, updates the `#__REQUESTDIGEST` hidden field in the DOM, and
 *   returns the token. This ensures all subsequent readers pick up the new value.
 *
 * - **Remote** (a different `siteUrl`):
 *   Checks an in-memory cache first. If a valid cached token exists, returns it
 *   immediately without an API call. Otherwise fetches a new token, caches it with a
 *   60-second safety buffer before the server-reported expiry, and returns it. The DOM
 *   `#__REQUESTDIGEST` field is NOT updated for remote tokens.
 *
 * Uses per-site request coalescing: if multiple callers invoke this function for the
 * same site while a refresh is already in flight, they all receive the same Promise.
 * The in-flight reference is cleared once the request settles (success or failure).
 *
 * Requests use `odata=nometadata` Accept headers. At runtime, the response is
 * validated against both `odata=nometadata` (top-level `GetContextWebInformation`)
 * and `odata=verbose` (`d.GetContextWebInformation`) formats, because SharePoint
 * may fall back to verbose format after session re-authentication.
 *
 * This function calls `$.ajax` directly instead of {@link baseRequest} to avoid
 * recursive retry loops (baseRequest calls this function on digest expiry).
 *
 * @param siteUrl - Optional absolute URL of the target site. When omitted or matching
 *   the local site, the local digest flow is used.
 *
 * @returns A Promise that resolves with the digest token string.
 *
 * @throws {SystemError} With name `"APIException: RequestDigestRefresh"` if the
 *   contextinfo request fails.
 */
declare function refreshRequestDigest(siteUrl?: string): Promise<string>;
/**
 * Starts a digest timer that detects sleep/suspend gaps and recovers the
 * request digest when the browser wakes up after an extended period.
 *
 * On each tick the timer checks whether the elapsed time since the previous
 * tick exceeds twice the expected interval. If it does (indicating the device
 * was asleep or the tab was suspended), it calls {@link refreshRequestDigest}
 * to obtain a fresh token. Normal ticks are no-ops -- the digest stays fresh
 * via SharePoint's native `UpdateFormDigest` mechanism as long as the tab is
 * active.
 *
 * The interval is determined from `_spPageContextInfo.formDigestTimeoutSeconds`
 * minus a 2-minute buffer, falling back to 25 minutes if unavailable.
 *
 * Idempotent: calling this multiple times clears the previous timer first.
 * On unrecoverable failure after sleep, shows a persistent Toast instructing
 * the user to reload.
 */
declare function startDigestTimer(): void;
/**
 * Stops the proactive digest refresh timer started by {@link startDigestTimer}.
 * Safe to call even when no timer is active.
 */
declare function stopDigestTimer(): void;

/**
 * @module RoleManager
 *
 * Provides the {@link RoleManager} class for list-based authorization.
 *
 * RoleManager loads a user's roles from a SharePoint list and provides
 * methods to check role membership and permission map access. Unlike
 * {@link CurrentUser}, RoleManager is NOT a singleton -- different apps
 * may use different list names or maintain multiple instances.
 *
 * **List structure:** The list stores one item per user, where:
 * - `Title` field contains the user's email address (used as lookup key)
 * - `Roles` field contains a JSON-serialized `string[]` (auto-parsed by ListApi)
 *
 * @example
 * ```ts
 * const roles = new RoleManager();
 * await roles.load('AppRoles');
 *
 * roles.hasRole('editor');                         // true/false
 * roles.hasAnyRole(['admin', 'editor']);            // true if user has either
 * roles.canAccess('reports', permissionMap);        // true if user's roles overlap
 * ```
 *
 * @see {@link CurrentUser} for the authenticated user singleton (must be initialized first).
 * @see {@link ListApi} for the underlying list query.
 */
/**
 * Maps resource keys to arrays of role names that grant access.
 *
 * Use `'*'` in the role array to grant access to all users regardless of roles.
 *
 * @example
 * ```ts
 * const permissions: PermissionMap = {
 *   dashboard: ['*'],                    // everyone
 *   reports:   ['admin', 'analyst'],     // admin or analyst
 *   settings:  ['admin'],                // admin only
 * };
 * ```
 */
interface PermissionMap {
    [key: string]: string[];
}
/**
 * List-based authorization class that loads user roles from a SharePoint list
 * and provides role-checking and permission-map utilities.
 *
 * Not a singleton -- instantiate per list or per context as needed.
 *
 * @example
 * ```ts
 * // Basic usage
 * const roles = new RoleManager();
 * await roles.load();                  // defaults to 'UserRoles' list
 *
 * if (roles.hasRole('admin')) { ... }
 *
 * // Permission map usage
 * const map: PermissionMap = {
 *   editProject: ['admin', 'manager'],
 *   viewProject: ['*'],
 * };
 * if (roles.canAccess('editProject', map)) { ... }
 * ```
 */
declare class RoleManager {
    #private;
    /**
     * Loads the current user's roles from the specified SharePoint list.
     *
     * Queries the list by `Title` (which should contain the user's email).
     * The `Roles` field is expected to be a JSON-serialized `string[]`,
     * which ListApi auto-parses back to a native array.
     *
     * If no matching item is found, the instance has zero roles -- this is
     * a valid state (no error thrown).
     *
     * @param listName - SharePoint list name to query. Defaults to `'UserRoles'`.
     */
    load(listName?: string): Promise<void>;
    /**
     * Returns `true` if the user has the exact specified role.
     *
     * @param role - Role name to check.
     */
    hasRole(role: string): boolean;
    /**
     * Returns `true` if the user has at least one of the specified roles.
     *
     * If `requiredRoles` contains `'*'`, returns `true` unconditionally
     * (wildcard grants access to all users).
     *
     * @param requiredRoles - Array of role names. Include `'*'` for wildcard.
     */
    hasAnyRole(requiredRoles: string[]): boolean;
    /**
     * Checks whether the user can access a resource defined in a {@link PermissionMap}.
     *
     * Looks up the key in the map and delegates to {@link hasAnyRole}.
     * Returns `false` if the key is not present in the map.
     *
     * @param key - Resource key to look up in the permission map.
     * @param permissionMap - Map of resource keys to required role arrays.
     */
    canAccess(key: string, permissionMap: PermissionMap): boolean;
    /**
     * Returns a shallow copy of the loaded roles array.
     * Returns an empty array if {@link load} has not been called.
     */
    get roles(): string[];
    /**
     * Whether {@link load} has completed successfully.
     * Lets apps distinguish "not yet loaded" from "loaded with zero roles".
     */
    get isLoaded(): boolean;
}

interface ContextStoreEntry {
    value: unknown;
    createdAt: number;
}
/**
 * Cross-route key-value store that lives in the bundle's module scope.
 * All-static class -- no instantiation. Accessible from any route or module
 * that imports from the base bundle.
 *
 * Values with a `dispose()` method (e.g. FormField) are automatically disposed
 * when removed via `delete()` or `clear()`.
 */
declare class ContextStore {
    #private;
    private constructor();
    static set<T>(key: string, value: T): void;
    static get<T>(key: string): T;
    static get<T>(key: string, fallback: T): T;
    static has(key: string): boolean;
    static delete(key: string): boolean;
    static clear(): void;
    static get size(): number;
    static keys(): string[];
}

declare class FormSchema<T extends Record<string, FormField<FormFieldType>>, K extends keyof T> {
    private _fields;
    constructor(fields: T);
    static fromKeys<const K extends readonly string[]>(fieldNames: K): FormSchema<{
        [P in K[number]]: FormField<FormFieldType>;
    }, K[number]>;
    validateAll(): boolean;
    validateAllAsync(): Promise<boolean>;
    get isValid(): boolean;
    get isValidating(): boolean;
    get hasUntouchedFields(): boolean;
    get isDirty(): boolean;
    focusOnFirstInvalid(): void;
    get(key: K): T[K];
    parse(): Record<string, FormFieldType>;
    parseForList(): Record<string, SPFieldValue>;
}

/**
 * Ensures unique values are generated during runtime.
 * @param {string} [prefix] An optional string for added security
 *
 * NOTE: RUNTIME UID ONLY!
 */
declare const generateRuntimeUID: (prefix?: string) => UUID;
/**
 * Generates a RFC4122 version 4 compliant UUID.
 * @returns {string} A randomly generated UUID string
 * @example
 * const id = generateUUIDv4(); // "550e8400-e29b-41d4-a716-446655440000"
 */
declare const generateUUIDv4: typeof v4;

/**
 * Resolves a path by replacing the `@` prefix with the appropriate SharePoint URL.
 *
 * @param path - The path string to resolve. Must start with `@` to be replaced.
 * @param options - Configuration options for path resolution.
 * @param options.useSiteRoot - If `true`, resolves to the site root URL. If `false` (default), resolves to the SiteAssets/app directory.
 * @param options.customPath - The application path to append to the web absolute URL when `useSiteRoot` is `false`. Defaults to `'SiteAssets/app'`.
 *
 * @returns The resolved absolute path with the `@` prefix replaced by the appropriate SharePoint URL.
 *
 * @throws {SystemError} Throws an error if the path is not a non-empty string.
 *
 * @example
 * ```typescript
 * // Resolves to: https://site.sharepoint.com/SiteAssets/app/images/logo.png
 * const resolvedPath = resolvePath('@/images/logo.png');
 *
 * // Resolves to: https://site.sharepoint.com/images/logo.png
 * const sitePath = resolvePath('@/images/logo.png', { useSiteRoot: true });
 *
 * // Resolves to: https://site.sharepoint.com/custom/path/images/logo.png
 * const customPath = resolvePath('@/images/logo.png', { customPath: 'custom/path' });
 * ```
 */
declare function resolvePath(path: string, { useSiteRoot, customPath }?: {
    useSiteRoot?: false;
    customPath: string;
}): string;

/**
 * Escapes a string for safe interpolation into HTML content or attribute context.
 * Converts the five characters with special meaning in HTML to entity equivalents.
 */
declare function escapeHtml(str: string): string;
/**
 * Alias for escapeHtml -- communicates intent for attribute contexts.
 */
declare const escapeAttr: typeof escapeHtml;

/**
 * Creates a strict proxy wrapper around an object that throws an error when accessing non-existent properties.
 *
 * This function wraps the provided object in a Proxy that intercepts property access operations.
 * If an attempt is made to access a property that doesn't exist on the object, a SystemError
 * is thrown instead of returning undefined. This helps catch typos and invalid property accesses
 * at runtime.
 *
 * @template T - The type of the object to be wrapped, must extend Object.
 * @param obj - The object to wrap with strict property access enforcement.
 * @returns A proxied version of the object that throws SystemError when accessing non-existent properties.
 * @throws {SystemError} When attempting to access a property that doesn't exist on the object.
 *
 * @example
 * ```typescript
 * const config = enforceStrictObject({ apiKey: 'secret', timeout: 5000 });
 * console.log(config.apiKey); // 'secret'
 * console.log(config.invalid); // Throws SystemError
 * ```
 */
declare function enforceStrictObject<T extends object>(obj: T): T;

declare function copyToClipboard(text: string): Promise<boolean>;

interface TabGroupProps<K extends string> extends Omit<ContainerProps, 'selectableItems'> {
    selectedTabKey?: K;
    onTabChangeHandler?: (tabConfig: TabConfig<K>) => void;
}
interface TabConfig<K extends string> {
    /** Unique key for the tab */
    key: K;
    /** Label displayed in the tab button */
    label: string;
    /** Content view for this tab */
    view: View;
    /** Whether this tab is disabled */
    disabled?: boolean;
}
/**
 * TabGroup component that combines tab navigation with view switching.
 * Uses ViewSwitcher internally to manage view transitions.
 */
declare class TabGroup<K extends string> extends Container {
    private _viewSwitcher;
    private _tabs;
    private _onTabChangeHandler;
    constructor(tabs: TabConfig<K>[], props?: TabGroupProps<K>);
    get [Symbol.toStringTag](): string;
    private _createTabButton;
    private _createTabNavigation;
    toString(): string;
    render(): void;
    private _updateActiveTab;
    private _onTabClickListeners;
    protected _applyEventListeners(): void;
    /**
     * Switch to a specific tab by key
     */
    setTab(tabKey: K): void;
    /**
     * Switch to a specific tab by index
     */
    setTabByIndex(index: number): void;
    /**
     * Navigate to the next tab (wraps around)
     */
    nextTab(): void;
    /**
     * Navigate to the previous tab (wraps around)
     */
    previousTab(): void;
    /**
     * Add new tabs dynamically
     */
    addTabs(...tabs: TabConfig<K>[]): void;
    /**
     * Get the currently active tab key
     */
    get currentTab(): K;
    /**
     * Get the currently active tab index
     */
    get currentTabIndex(): number;
    /**
     * Get the current view
     */
    get currentView(): View;
}

type FieldLabelPosition = 'left' | 'top' | 'right' | 'bottom';
interface FieldLabelProps extends HTMDElementProps {
    /**
     * Position of the label relative to the wrapped component
     * @default 'top'
     */
    position?: FieldLabelPosition;
    /**
     * Tooltip text to display on hover
     */
    tooltip?: string;
}
/**
 * FieldLabel component that wraps any HTMDElement with a label.
 * Provides flexible positioning and optional tooltip functionality.
 *
 * @example
 * ```typescript
 * const input = new TextInput('', { placeholder: 'Enter your name' });
 * const field = new FieldLabel('Full Name', input, {
 *   position: 'top',
 *   tooltip: 'Please enter your full legal name'
 * });
 * field.render();
 * ```
 */
declare class FieldLabel extends HTMDElement {
    private _labelText;
    private _position;
    private _tooltip?;
    private _componentId?;
    constructor(labelText: string, component: HTMDElement, props?: FieldLabelProps);
    get [Symbol.toStringTag](): string;
    get modifierClasses(): string;
    /**
     * Generates the label HTML with optional tooltip
     */
    private _createLabel;
    toString(): string;
    render(): void;
    /**
     * Updates the label text
     */
    set label(text: string);
    /**
     * Updates the tooltip text
     */
    set tooltip(tooltip: string | undefined);
    /**
     * Updates the position of the label
     */
    set position(position: FieldLabelPosition);
    /**
     * Gets the label text
     */
    get label(): string;
    /**
     * Gets the current position
     */
    get position(): FieldLabelPosition;
    /**
     * Gets the tooltip text
     */
    get tooltip(): string | undefined;
}

declare global {
    interface Window {
        $: typeof $;
        jquery: typeof $;
        displaySharePointUI?: () => void;
    }
}

export { AccordionGroup, AccordionItem, Button, Card, CheckBox, ComboBox, Container, ContextStore, CurrentUser, DateInput, DateRangeInput, Dialog, ErrorBoundary, FORMAT_MAP, FieldLabel, FormControl, FormField, FormSchema, Fragment, HTMDElement, Image, LinkButton, List, Loader, MAX_RECIPIENTS_PER_CALL, Modal, NavigationEvent, NumberInput, PeoplePicker, RoleManager, Router, SP_ACCEPT_MINIMAL, SidePanel, SimpleElapsedTimeBenchmark, SiteApi, StyleResource, SystemError, TabGroup, Text, TextArea, TextInput, Toast, UserIdentity, View, ViewSwitcher, copyToClipboard, defineRoute, enforceStrictObject, escapeAttr, escapeHtml, extractComboBoxValue, fromFieldValue, generateRuntimeUID, generateUUIDv4, getFullUserDetails, getIcon, getUserProfile, isComboBoxOption, listIcons, pageReset, refreshRequestDigest, registerIcons, resolveEmailsToLogins, resolvePath, sanitizeQuery, searchUsers, sendEmail, spDELETE, spGET, spMERGE, spPOST, startDigestTimer, stopDigestTimer, toFieldValue };
export type { AccordionGroupProps, AccordionItemProps, AugmentedSystemError, BuiltInIconName, ButtonProps, CAMLCondition, CAMLOperator, CAMLOrderByField, CAMLQueryObject, CAMLQueryResponse, CAMLValueOperator, CardProps, CardVariants, ChildrenOptions, ComboBoxDataset, ComboBoxOptionProps, ComboBoxProps, ContainerProps, ContainerTags, ContextStoreEntry, CreateFieldOptions, CreateListOptions, DATE_FORMATS, DateInputProps, DateRangeInputProps, DateRangeRules, DialogProps, DialogVariants, ErrorBoundaryProps, ErrorOptions, FieldLabelPosition, FieldLabelProps, FormControlProps, FormFieldProps, FormFieldType, FragmentProps, FullUserDetails, GetItemsOptions, GetItemsPagedOptions, GroupHierarchyEntry, HTMDElementInterface, HTMDElementProps, HTMDNode, HTMDSingleNode, IconName, IconSource, ImageProps, InitializeOptions, LinkButtonProps, ListApiOptions, ListProps, LoaderProps, ModalProps, NavigationGuardFn, NavigationOptions, NumberInputProps, PaginatedResult, PeoplePickerProps, PeopleSearchOptions, PeopleSearchResult, PeopleSearchResultData, PermissionMap, ProfileProperty, ResolveEmailsResult, RouteConfig, RouteOptions, RoutePaths, RouterProps, RuntimeEventListenerOptions, RuntimeEventOptions, SPCollectionResponse, SPField, SPFieldValue, SPGroup, SPItemWithETag, SPList, SPRequestOptions, SPSimpleValue, SPUser, SPWeb, SendEmailArgs, SendEmailResult, SidePanelProps, SiteUserRow, StyleResourceOptions, TabConfig, TabGroupProps, TextAreaProps, TextInputProps, TextProps, ToastLoadingController, ToastOptions, ToastPromiseMessages, ToastType, Unsubscribe, UserIdentityProperties, UserProfile, UserProfilePayload, ViewProps, ViewSwitcherProps, pageResetOptions };
