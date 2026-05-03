export function shapePath(shape: any, w: any, h: any): {
    d: string;
    cx: number;
    cy: number;
    rx: number;
    circle?: undefined;
    ellipse?: undefined;
    top?: undefined;
    body?: undefined;
} | {
    d: string;
    cx: number;
    cy: number;
    circle: {
        cx: number;
        cy: number;
        r: number;
    };
    rx?: undefined;
    ellipse?: undefined;
    top?: undefined;
    body?: undefined;
} | {
    d: string;
    cx: number;
    cy: number;
    ellipse: {
        cx: number;
        cy: number;
        rx: number;
        ry: number;
    };
    rx?: undefined;
    circle?: undefined;
    top?: undefined;
    body?: undefined;
} | {
    d: string;
    cx: number;
    cy: number;
    rx?: undefined;
    circle?: undefined;
    ellipse?: undefined;
    top?: undefined;
    body?: undefined;
} | {
    d: string;
    top: string;
    body: string;
    cx: number;
    cy: number;
    rx?: undefined;
    circle?: undefined;
    ellipse?: undefined;
};
export function shapeAnchor(node: any, side: any): {
    x: any;
    y: any;
};
//# sourceMappingURL=shapes.d.ts.map