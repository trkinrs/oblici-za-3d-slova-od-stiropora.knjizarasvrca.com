(GRBL direction test - 20 x 20 mm square)
(Heating OFF. Set work X0 Y0 at the TOP LEFT of clear space.)
(Expected: RIGHT 20, DOWN 20, LEFT 20, UP 20.)
(No homing or automatic work-zero changes.)
M5
G21
G90
G94
G1 X0.000 Y0.000 F500
G1 X20.000 Y0.000
G1 X20.000 Y-20.000
G1 X0.000 Y-20.000
G1 X0.000 Y0.000
M5

