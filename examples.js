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
];
