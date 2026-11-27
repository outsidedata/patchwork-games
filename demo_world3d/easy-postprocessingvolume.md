# Easy postprocessing volume

A program reads the solver's XML and writes down what is in it. It works nothing out and sends no
probes.

## Rooms

A room is a pro-ng shape: a box, a cylinder. A solver places shapes, but a solver is not a room. The
XML holds each shape and where it stands. A room's parent is the shape it sits inside.

A room's shape is its postprocessing volume. When the camera is in a shape, that room's look is used.

Outside is not a room. The camera is outside when it is in no room's shape.

## Outside light

Outside light spills into a room when:

- the room has a window, or
- the room has a door that leads into no other room.

A room with a door that leads into another room, and no window, gets no outside light.
