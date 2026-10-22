// The example programs. `kind` is only for the list: "slow" ones show the busy state, "error" ones show the error display.
export const examples = [
  { id: 'difference', title: 'Difference: a cube with a ball cut out', program:
`; a hollow in a block: the sphere pokes through every face
(difference
  (cube-centered 20 20 20)
  (sphere 13 4))
` },
  { id: 'union', title: 'Union: a block, a tower and a ball', program:
`(def base (cube 30 20 4))
(union
  base
  (translate 5 5 4 (cube 8 10 14))
  (translate 22 10 10 (sphere 7 3)))
` },
  { id: 'intersection', title: 'Intersection: a rounded block', program:
`; what the cube and the sphere have in common
(intersection
  (cube-centered 20 20 20)
  (sphere 14 4))
` },
  { id: 'holes', title: 'Difference: a plate with a grid of holes', program:
`(def plate (cube 40 28 4))
(def hole (cylinder 6 2.5 2.5 24))   ; taller than the plate, so it cuts through
(difference
  plate
  (repeat i 4
    (repeat j 3
      (translate (+ 6 (* i 9)) (+ 5.5 (* j 8.5)) -1 hole))))
` },
  { id: 'two-holes', title: 'Difference: a slab, two holes', program:
`; the union of two separate cylinders taken from a slab in one difference
(difference
  (cube 10 10 2)
  (union
    (translate 5 5 -1 (cylinder 4 1 1 16))
    (translate 8 5 -1 (cylinder 4 1 1 16))))
` },
  { id: 'extrude', title: 'Extrude: an L bracket with two holes', program:
`; outlines may be written either way round
(extrude 6
  (polygon 0 0, 30 0, 30 8, 8 8, 8 30, 0 30)
  (polygon 3 3, 3 5, 5 5, 5 3)
  (polygon 3 22, 3 26, 5 26, 5 22))
` },
  { id: 'revolve', title: 'Revolve: a vase', program:
`; x is the distance from the axis, y the height
(revolve 48
  (polygon 0 0, 8 0, 9 2, 6 10, 5 16, 8 24, 9 30, 7 30, 6 24, 3 16, 4 10, 0 3))
` },
  { id: 'ring', title: 'Revolve: a ring with a hole through it', program:
`; the profile does not touch the axis, so the ring has genus 1; the hole goes through the wall
(def ring (revolve 64 (polygon 8 0, 11 0, 11 3, 8 3)))
(difference ring (translate 7 0 1.5 (rotate 0 90 0 (cylinder 6 0.8 0.8 16))))
` },
  { id: 'gear', title: 'Union and difference: a toothed wheel', program:
`(def hub (cylinder 4 9 9 40))
(def tooth (translate 8 -1.2 0 (cube 4 2.4 4)))
(def bore (translate 0 0 -1 (cylinder 6 3 3 24)))
(difference
  (union hub (repeat k 12 (rotate 0 0 (* k 30) tooth)))
  bore)
` },
  { id: 'slow', kind: 'slow', title: 'Slow: two fine spheres, three booleans', program:
`; 8192 faces each: a few seconds in the browser (the page stays usable; Cancel stops it)
(def a (sphere 10 5))
(def b (translate 7 3 2 (sphere 10 5)))
(difference
  (union a b)
  (intersection a b))
` },
  { id: 'error-name', kind: 'error', title: 'Error: a misspelled name', program:
`(def width 12)
(union
  (cube width 12 12)
  (translate 20 0 0 (cube widht 12 12)))   ; the typo is on this line
` },
  { id: 'error-polygon', kind: 'error', title: 'Error: a polygon that crosses itself', program:
`; a bow-tie outline is not a shape
(extrude 4 (polygon 0 0, 10 0, 2 8, 8 8))
` },
  { id: 'error-paren', kind: 'error', title: 'Error: a missing parenthesis', program:
`(union
  (cube 10 10 10)
  (translate 5 5 5 (sphere 6 3))
` },
  { id: 'fillet-block', title: 'Fillet: a block with rounded corners', program:
`; the four vertical edges, found by asking for them: parallel to z
(def block (cube 30 20 10))
(fillet block
  (edges-where block (parallel 0 0 1))
  4 12)                          ; radius 4, 12 segments in the arc
` },
  { id: 'chamfer-hole', title: 'Chamfer: a block with a hole', program:
`; the long vertical convex edges are the corners of the block; the hole's own edges are concave
(def block
  (difference
    (cube 30 20 10)
    (translate 15 10 -1 (cylinder 12 4 4 24))))
(chamfer block
  (edges-where block (and (parallel 0 0 1) (convex) (length-above 9)))
  3)
` },
  { id: 'fillet-query', title: 'Fillet by query: edges follow a change', program:
`; no edge is named by number: the fillet is "the long, vertical, convex edges".
; Change w (the width) or hx (where the hole is) and run it again.
(def w 40)
(def hx 12)
(def block
  (difference
    (cube w 24 8)
    (translate hx 12 -1 (cylinder 10 3 3 20))))
(fillet block
  (edges-where block (and (parallel 0 0 1) (convex) (length-above 7)))
  3 8)
` },
  { id: 'fillet-concave', title: 'Fillet: an inside corner adds material', program:
`; the concave edge of an L bracket is filled, the convex ones are left sharp
(def bracket (extrude 6 (polygon 0 0, 30 0, 30 8, 8 8, 8 24, 0 24)))
(fillet bracket (edges-where bracket (concave)) 4 10)
` },
  { id: 'error-select', kind: 'error', title: 'Error: a query that matches nothing', program:
`; there is no edge above z = 20 on a block 10 high: the error says so, at the query
(def block (cube 30 20 10))
(fillet block (edges-where block (z-above 20)) 2)
` },
  { id: 'error-corner', kind: 'error', title: 'Error: a corner that is not a box corner', program:
`; two edges of a hexagonal prism meet at a corner whose faces are not at right angles:
; box corners are blended, other corners are refused with the reason
(def prism (extrude 3 (polygon 2 0, 1 1.732, -1 1.732, -2 0, -1 -1.732, 1 -1.732)))
(fillet prism (edges-where prism (and (on-top) (near 2 0 3 0.1))) 0.5)
` },
  { id: 'fillet-box-all', title: 'Fillet: a box with every edge rounded', program:
`; all twelve edges: at each corner the three fillets meet in a sphere octant (the ball that rolls along the edges)
(def box (cube 30 20 10))
(fillet box (edges-where box (and)) 3 8)
` },
  { id: 'fillet-cylinder-rim', title: 'Fillet: a cylinder with a rounded rim', program:
`; a circle is the closed chain of a cylinder's facet edges: rims-where selects it as one edge
(def can (cylinder 20 10 10 48))
(fillet can (rims-where can (and (circular) (on-top))) 2 8)
` },
  { id: 'fillet-hole-rim', title: 'Fillet: a plate with a rounded hole', program:
`; both rims of the hole are rounded: the cutter is the profile turned about the hole's axis
(def plate
  (difference
    (cube 60 40 8)
    (translate 30 20 -1 (cylinder 10 8 8 48))))
(fillet plate (rims-where plate (circular)) 1.5 8)
` },
  { id: 'fillet-boss-ring', title: 'Fillet: a boss with a concave fillet', program:
`; the ring where the boss meets the plate is concave: material is added
(def part
  (union
    (cube 60 40 6)
    (translate 30 20 6 (cylinder 14 7 7 48))))
(fillet part (rims-where part (concave)) 2.5 8)
` },
  { id: 'spring', title: 'Sweep: a coil spring', program:
`; a coil spring: a round wire (a 12-gon, 0.8 across) swept along a helix of radius 6 and pitch 3, five turns, 16 segments a turn
(def wire (polygon 0.4 0, 0.35 0.2, 0.2 0.35, 0 0.4, -0.2 0.35, -0.35 0.2, -0.4 0, -0.35 -0.2, -0.2 -0.35, 0 -0.4, 0.2 -0.35, 0.35 -0.2))
(sweep (helix 6 3 5 16) wire)
` },
  { id: 'pipe', title: 'Sweep: a pipe with a bend', program:
`; a pipe with a bend: a straight run joined to a Bezier that turns it sideways. The profile is a ring (an outline and a hole), swept along the whole path.
(def outer (polygon 2 0, 1.73 1, 1 1.73, 0 2, -1 1.73, -1.73 1, -2 0, -1.73 -1, -1 -1.73, 0 -2, 1 -1.73, 1.73 -1))
(def bore (polygon 1.4 0, 1.21 0.7, 0.7 1.21, 0 1.4, -0.7 1.21, -1.21 0.7, -1.4 0, -1.21 -0.7, -0.7 -1.21, 0 -1.4, 0.7 -1.21, 1.21 -0.7))
(def path (join (polyline 0 0 0, 0 0 12) (bezier 0 0 0, 0 0 10, 12 0 10, 12 0 20 20)))
(sweep path outer bore)
` },
  { id: 'bolt', title: 'Threads: a bolt and its nut', program:
`; an M8x1.25 hex bolt (ISO metric thread, 16 segments a turn) with its nut at the stated clearance of 0.15: two separate pieces, 0.15 apart everywhere.
; The thread is absolute in z, so a nut set a whole number of pitches (5 x 1.25) up the bolt meshes with it.
(def bolt (screw-hex 8 1.25 13 5.3 4 14 16))
(def nut (nut 8 1.25 6.5 13 16 0.15))
(union bolt (translate 0 0 6.25 nut))
` },
  { id: 'twisted-bar', title: 'Twisted extrude: a star bar', program:
`; a twisted bar: a five-pointed star turned through 144 degrees over its 30 mm length in 30 slices
(twist-extrude 30 144 30
  (polygon 6 0, 2.4 1.7, 1.9 5.7, -0.9 2.8, -4.9 3.6, -3 0, -4.9 -3.6, -0.9 -2.8, 1.9 -5.7, 2.4 -1.7))
` },
  { id: 'torus', title: 'Sweep: a torus (a closed path)', program:
`; an arc of 360 degrees is a closed path: the ring joins up with no seam. The first frame vector of an arc is the z axis, the second points outward.
(sweep (arc 12 360 48)
  (polygon 0 -2, 1.4 -1.4, 2 0, 1.4 1.4, 0 2, -1.4 1.4, -2 0, -1.4 -1.4))
` },
  { id: 'frame', title: 'Sweep: a mitered closed frame', program:
`; a closed polyline: each corner is cut on the bisector plane and the square profile is stretched so that the bars keep their thickness. The path rises 5 at one corner.
(sweep (polyline-closed 0 0 0, 24 0 0, 24 20 5, 0 20 0)
  (polygon -1.5 -1.5, 1.5 -1.5, 1.5 1.5, -1.5 1.5))
` },
  { id: 'tapered', title: 'Sweep: twisted and tapered', program:
`; sweep-with twist-degrees end-scale path profile: the profile turns through 270 degrees and shrinks to a third while it follows the curve
(sweep-with 270 0.33
  (bezier 0 0 0, 0 0 20, 15 0 20, 15 0 40 32)
  (polygon 3 0, 1 1, 0 3, -1 1, -3 0, -1 -1, 0 -3, 1 -1))
` },
  { id: 'ribbon', title: 'Helix: an axial sweep', program:
`; helix-axial pitch turns segments: the profile (x = distance from the axis, y = height) is turned about the z axis and lifted by the pitch each turn, like revolve
(sweep (helix-axial 3 4 24)
  (polygon 3 0, 5 0, 5 1.5, 3 1.5))
` },
  { id: 'cap-screw', title: 'Threads: a cylinder-head screw', program:
`; screw-cylinder diameter pitch head-diameter head-height shank-length thread-length segments; the ISO metric basic profile, M6 x 1
(screw-cylinder 6 1 10 6 4 12 20)
` },
  { id: 'error-sweep', kind: 'error', title: 'Error: a profile too wide for its bend', program:
`; the pipe's profile is 6 wide but the bend has a radius of 2: the inside of the bend would fold over itself, and the sweep says so
(sweep (arc 2 180 16) (polygon -1 -3, 1 -3, 1 3, -1 3))
` },
];
