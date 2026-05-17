export function shapePath(shape: any, w: any, h: any, node: any): {
    d: string;
    cx: number;
    cy: number;
    circle: {
        cx: number;
        cy: number;
        r: number;
    };
    ellipse?: undefined;
    top?: undefined;
    body?: undefined;
    decor?: undefined;
    rx?: undefined;
    head?: undefined;
    noShadow?: undefined;
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
    circle?: undefined;
    top?: undefined;
    body?: undefined;
    decor?: undefined;
    rx?: undefined;
    head?: undefined;
    noShadow?: undefined;
} | {
    d: string;
    cx: number;
    cy: number;
    circle?: undefined;
    ellipse?: undefined;
    top?: undefined;
    body?: undefined;
    decor?: undefined;
    rx?: undefined;
    head?: undefined;
    noShadow?: undefined;
} | {
    d: string;
    top: string;
    body: string;
    cx: number;
    cy: number;
    circle?: undefined;
    ellipse?: undefined;
    decor?: undefined;
    rx?: undefined;
    head?: undefined;
    noShadow?: undefined;
} | {
    d: string;
    decor: string;
    cx: number;
    cy: number;
    rx: number;
    circle?: undefined;
    ellipse?: undefined;
    top?: undefined;
    body?: undefined;
    head?: undefined;
    noShadow?: undefined;
} | {
    d: string;
    head: {
        cx: number;
        cy: number;
        r: number;
    };
    body: string;
    cx: number;
    cy: number;
    noShadow: boolean;
    circle?: undefined;
    ellipse?: undefined;
    top?: undefined;
    decor?: undefined;
    rx?: undefined;
} | {
    d: any;
    cx: number;
    cy: number;
    rx: number;
    circle?: undefined;
    ellipse?: undefined;
    top?: undefined;
    body?: undefined;
    decor?: undefined;
    head?: undefined;
    noShadow?: undefined;
};
export function shapeAnchor(node: any, side: any): {
    x: any;
    y: any;
};
//# sourceMappingURL=shapes.d.ts.map