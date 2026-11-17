import * as d3 from 'd3';
export { d3 };

interface BarChartData {
    label: string;
    value: number;
}
declare class BarChart {
    private _container;
    private _data;
    private _width;
    private _height;
    constructor(containerId: string, data: BarChartData[]);
    render(): void;
}

interface CirclePackingNode {
    name: string;
    value?: number;
    children?: CirclePackingNode[];
}
interface CirclePackingChartOptions {
    data?: CirclePackingNode;
    width?: number;
    height?: number;
    responsive?: boolean;
}
declare class CirclePackingChart {
    private _container;
    private _data;
    private _width;
    private _height;
    private _responsive;
    private _svg;
    private _resizeObserver;
    constructor(container: HTMLElement | string, options?: CirclePackingChartOptions | CirclePackingNode);
    /**
     * Generate default hierarchical dummy data
     */
    private _getDefaultData;
    /**
     * Render the circle packing chart
     */
    render(): void;
    /**
     * Set new data and re-render
     */
    setData(data: CirclePackingNode): void;
    /**
     * Update dimensions
     */
    setDimensions(width: number, height: number): void;
    /**
     * Enable or disable responsive mode
     */
    setResponsive(responsive: boolean): void;
    /**
     * Get current dimensions
     */
    getDimensions(): {
        width: number;
        height: number;
    };
    /**
     * Destroy the chart and clean up
     */
    destroy(): void;
}

interface RadarChartDataPoint {
    name: string;
    values: {
        [axisName: string]: number;
    };
}
interface RadarChartOptions {
    data?: RadarChartDataPoint[];
    width?: number;
    height?: number;
    responsive?: boolean;
    axes?: string[];
    levels?: number;
    maxValue?: number;
    labelFactor?: number;
    wrapWidth?: number;
    opacityArea?: number;
    dotRadius?: number;
    opacityCircles?: number;
    strokeWidth?: number;
}
declare class RadarChart {
    private _container;
    private _data;
    private _width;
    private _height;
    private _responsive;
    private _axes;
    private _levels;
    private _maxValue;
    private _labelFactor;
    private _wrapWidth;
    private _opacityArea;
    private _dotRadius;
    private _opacityCircles;
    private _strokeWidth;
    private _svg;
    private _resizeObserver;
    private readonly _colors;
    constructor(container: HTMLElement | string, options?: RadarChartOptions);
    /**
     * Generate default dummy data
     */
    private _getDefaultData;
    /**
     * Render the radar chart
     */
    render(): void;
    /**
     * Wrap text into multiple lines
     */
    private _wrap;
    /**
     * Set new data and re-render
     */
    setData(data: RadarChartDataPoint[], axes?: string[]): void;
    /**
     * Update dimensions
     */
    setDimensions(width: number, height: number): void;
    /**
     * Enable or disable responsive mode
     */
    setResponsive(responsive: boolean): void;
    /**
     * Get current dimensions
     */
    getDimensions(): {
        width: number;
        height: number;
    };
    /**
     * Get current axes
     */
    getAxes(): string[];
    /**
     * Destroy the chart and clean up
     */
    destroy(): void;
}

export { BarChart, CirclePackingChart, RadarChart };
export type { CirclePackingChartOptions, CirclePackingNode, RadarChartDataPoint, RadarChartOptions };
