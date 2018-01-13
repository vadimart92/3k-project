var myPoints = [10, 10, 40, 30, 100, 10, 200, 100, 200, 50, 250, 120]; //minimum two points

function createArrow(arrowColor,arrowThickness,arrowOpacity,xstart,ystart) {
    return {
        color: arrowColor,
        thickness: arrowThickness,
        opacity:arrowOpacity,
        points:[
            {x: xstart,y:ystart},
        ]
    }
}

var activeArrows = [];

var arrowSettings = {
    arrowColor: "#00AAFF",
    arrowThickness: 3,
    arrowSimplification: 500,
    arrowSnap: false,

    drawingArrow: null,
};

/**
 * Main arrow drawing function
 * @param {Object<>} ctx context
 * @param {number} width 
 * @param {number} height 
 * @returns {} 
 */
function drawArrows(ctx, width, height) {
    
    var tension = 1;
    
    //Draw saved arrow as curve

    for (let arrow of activeArrows) {
        
        ctx.strokeStyle = arrow.color;
        ctx.lineWidth = arrow.thickness;
        ctx.globalAlpha = arrow.opacity;

        drawCurve(ctx, arrow.points, 0.5);
    }

    //Draw currently created arrow as linelist, if any

    if (arrowSettings.drawingArrow != null) {
        ctx.beginPath();

        ctx.globalAlpha = arrowSettings.drawingArrow.opacity;
        ctx.strokeStyle = arrowSettings.drawingArrow.color;
        ctx.lineWidth = arrowSettings.drawingArrow.thickness;

        drawLines(ctx, arrowSettings.drawingArrow.points);
        ctx.stroke();
    }

    ctx.globalAlpha = 1;
}

function removeLastArrow() {
    activeArrows.splice(activeArrows.length - 1, 1);
    redraw();
}


function removeAllArrows() {
    activeArrows = [];
    redraw();
}

/**
 * Called from main.js on mouse move/up/down
 * @param {} px cursor x
 * @param {} py cursor y
 * @param {} cavnas 
 * @param {string} evtype event type : 'mousedown'/'mousemove'/'mouseup'
 * @returns {} 
 */
function createArrowsHandler(px, py, cavnas, evtype) {
    switch (evtype) {
        case 'mousedown':

            arrowSettings.arrowColor = document.querySelector("#arrow-color").value;
            arrowSettings.arrowThickness = document.querySelector("#arrow-thickness").value;
            arrowSettings.arrowOpacity = 1.0 -document.querySelector("#arrow-transparency").value/100.0;
            arrowSettings.arrowSimplification = document.querySelector("#arrow-simplification").value;
            arrowSettings.arrowSnap = document.querySelector("#arrow-snap").checked;

            arrowSettings.drawingArrow = createArrow(arrowSettings.arrowColor, arrowSettings.arrowThickness, arrowSettings.arrowOpacity, px, py);
            redraw();
            break;
        case 'mousemove':
            if (arrowSettings.drawingArrow != null) {

                arrowSettings.drawingArrow.points.push({ x: px, y: py });

                redraw();
            }
            break;
        case 'mouseup':

            if (arrowSettings.drawingArrow != null) {
                activeArrows.push(cleanupArrow(arrowSettings.drawingArrow));
                arrowSettings.drawingArrow = null;
                redraw();
            }

            break;
        default:
    }
}

/**
 * Takes point list and reduces its count using Ramer-Douglas-Peucker algo
 * @param {} arrow 
 * @returns {}
 */
function cleanupArrow(arrow) {

    if (arrowSettings.arrowSnap ) {

        var start = arrow.points[0];
        var end = arrow.points[arrow.points.length-1];

        var snappoints = chordDefinitions.map((ch) => {
            return {
                x: ch.actualPx,
                y: ch.actualPy,
                ds:(ch.actualPx - start.x) * (ch.actualPx - start.x) +
                    (ch.actualPy - start.y) * (ch.actualPy - start.y),
                de: (ch.actualPx - end.x) * (ch.actualPx - end.x) +
                    (ch.actualPy - end.y) * (ch.actualPy - end.y)};
        });

        var startsnap = snappoints.sort(function(d1, d2) {
            return d1.ds - d2.ds;
        })[0];

        var endsnap = snappoints.sort(function (d1, d2) {
            return d1.de - d2.de;
        })[0];

        //Step off center to give chord name some space

        var gracedistance = 20;
        var filterdistance = gracedistance*1.5;

        arrow.points = arrow.points.filter(function(pt) {
            return getSqDist(pt, startsnap) > filterdistance * filterdistance &&
                getSqDist(pt, endsnap) > filterdistance * filterdistance;
        });


        if (arrow.points.length < 2)
            arrow.points = [startsnap, endsnap];

        var first = arrow.points[0];
        var last = arrow.points[arrow.points.length - 1];

        var lenstart = Math.sqrt(getSqDist(startsnap, first));
        var lenend = Math.sqrt(getSqDist(endsnap, last));

        var ns = {
            x: (startsnap.x - first.x) / lenstart,
            y: (startsnap.y - first.y) / lenstart,
        };
        var ne = {
            x: (endsnap.x - last.x) / lenend,
            y: (endsnap.y - last.y) / lenend,
        };

        startsnap.x -= ns.x * gracedistance;
        startsnap.y -= ns.y * gracedistance;

        endsnap.x -= ne.x * gracedistance;
        endsnap.y -= ne.y * gracedistance;

        //Replace start-end
        
        arrow.points[0] = { x: startsnap.x, y: startsnap.y };
        arrow.points[arrow.points.length - 1] = { x: endsnap.x, y: endsnap.y };
    }

    arrow.points = simplifyDouglasPeucker(arrow.points, arrowSettings.arrowSimplification);

    return arrow;
}

/**
 * Calculate square distance from a point to a segment
 * @param {} p test point 
 * @param {} p1 segment start
 * @param {} p2 segment end
 * @returns {number} Squared distance from point p to segment p1-p2
 */
function getSqSegDist(p, p1, p2) {

    var x = p1.x,
        y = p1.y,
        dx = p2.x - x,
        dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {

        var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

        if (t > 1) {
            x = p2.x;
            y = p2.y;

        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = p.x - x;
    dy = p.y - y;

    return dx * dx + dy * dy;
}

function getSqDist(p1,p2) {
    return (p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y);
}

function simplifyDPStep(points, first, last, sqTolerance, simplified) {
    var maxSqDist = sqTolerance,
        index;

    for (var i = first + 1; i < last; i++) {
        var sqDist = getSqSegDist(points[i], points[first], points[last]);

        if (sqDist > maxSqDist) {
            index = i;
            maxSqDist = sqDist;
        }
    }

    if (maxSqDist > sqTolerance) {
        if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
        simplified.push(points[index]);
        if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
    }
}

// simplification using Ramer-Douglas-Peucker algorithm
function simplifyDouglasPeucker(points, sqTolerance) {
    var last = points.length - 1;

    var simplified = [points[0]];
    simplifyDPStep(points, 0, last, sqTolerance, simplified);
    simplified.push(points[last]);

    return simplified;
}

/**
 * Given control points list, creates intermediate points using cardinal splines
 * @param {} pts 
 * @param {} tension 
 * @returns {} 
 */
function getCurvePoints(pts, tension) {

    // use input value if provided, or use a default value	 
    tension = (typeof tension != 'undefined') ? tension : 0.5;
    numOfSegments = 16;

    var ptsCopy = [], result = [],	// clone array
        x, y,			// our x,y coords
        t1x, t2x, t1y, t2y,	// tension vectors
        c1, c2, c3, c4,		// cardinal points
        st, t, i;		// steps based on num. of segments

    // clone array so we don't change the original    
    ptsCopy = pts.slice(0);

    // The algorithm require a previous and next point to the actual point array.
    // Duplicate first & last points
    ptsCopy.unshift(pts[0]);
    ptsCopy.push(pts[pts.length - 1]);
    
    for (i = 1; i < (ptsCopy.length - 2) ; i ++) {
        for (t = 0; t <= numOfSegments; t++) {

            // calc tension vectors
            t1x = (ptsCopy[i + 1].x - ptsCopy[i - 1].x) * tension;
            t2x = (ptsCopy[i + 2].x - ptsCopy[i].x) * tension;

            t1y = (ptsCopy[i + 1].y - ptsCopy[i - 1].y) * tension;
            t2y = (ptsCopy[i + 2].y- ptsCopy[i].y) * tension;

            // calc step
            st = t / numOfSegments;

            // calc cardinals
            c1 = 2 * Math.pow(st, 3) - 3 * Math.pow(st, 2) + 1;
            c2 = -(2 * Math.pow(st, 3)) + 3 * Math.pow(st, 2);
            c3 = Math.pow(st, 3) - 2 * Math.pow(st, 2) + st;
            c4 = Math.pow(st, 3) - Math.pow(st, 2);

            // calc x and y cords with common control vectors
            x = c1 * ptsCopy[i].x + c2 * ptsCopy[i + 1].x + c3 * t1x + c4 * t2x;
            y = c1 * ptsCopy[i].y + c2 * ptsCopy[i + 1].y + c3 * t1y + c4 * t2y;

            //store points in array
            result.push({x:x,y:y});
        }
    }

    return result;
}


function drawCurve(ctx, ptsa, tension) {

    var points = getCurvePoints(ptsa, tension);
    ctx.beginPath();

    ctx.lineCap = "round";

    //Draw curve body
    drawLines(ctx, points);

    //Draw arrow cap
    var headlen = 15;   // length of head in pixels
    var weldlen = 0; //aux offset to make arrow fin to end nicely

    var last = points[points.length - 1];
    var prev = points[points.length - 2];
    var angle = Math.atan2(last.y - prev.y, last.x - prev.x);

    for (var leg = 0; leg < 2; leg++) {

        var legAngle = leg == 0 ? -Math.PI / 6 : Math.PI / 6;

        var dx = Math.cos(angle + legAngle);
        var dy = Math.sin(angle + legAngle);

        ctx.moveTo(last.x + weldlen * dx, last.y + weldlen * dy);
        ctx.lineTo(last.x - headlen * dx, last.y - headlen * dy);

    }

    ctx.stroke();
}

function drawLines(ctx, pts) {

    if (pts.length < 2)
        return;

    ctx.moveTo(pts[0].x, pts[0].y);

    for (i = 1; i < pts.length; i++)
        ctx.lineTo(pts[i].x, pts[i].y);
}