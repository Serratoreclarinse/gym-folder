export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Legs'
  | 'Shoulders'
  | 'Arms'
  | 'Core'
  | 'Cardio';

export type LibraryExercise = {
  name: string;
  muscle: MuscleGroup;
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio',
];

export const EXERCISE_LIBRARY: LibraryExercise[] = [

  // ── CHEST ─────────────────────────────────────────────────────────────────
  // Barbell
  { name: 'Bench Press', muscle: 'Chest' },
  { name: 'Close Grip Bench Press', muscle: 'Chest' },
  { name: 'Decline Bench Press', muscle: 'Chest' },
  { name: 'Floor Press', muscle: 'Chest' },
  { name: 'Guillotine Press', muscle: 'Chest' },
  { name: 'Incline Bench Press', muscle: 'Chest' },
  { name: 'Reverse Grip Bench Press', muscle: 'Chest' },
  { name: 'Spoto Press', muscle: 'Chest' },
  // Dumbbell
  { name: 'Chest Fly', muscle: 'Chest' },
  { name: 'Decline Dumbbell Press', muscle: 'Chest' },
  { name: 'Dumbbell Chest Press', muscle: 'Chest' },
  { name: 'Dumbbell Floor Press', muscle: 'Chest' },
  { name: 'Dumbbell Pullover', muscle: 'Chest' },
  { name: 'Hex Press', muscle: 'Chest' },
  { name: 'Incline Chest Fly', muscle: 'Chest' },
  { name: 'Incline Dumbbell Press', muscle: 'Chest' },
  { name: 'Neutral Grip Dumbbell Press', muscle: 'Chest' },
  { name: 'Squeeze Press', muscle: 'Chest' },
  { name: 'Svend Press', muscle: 'Chest' },
  // Cable
  { name: 'Cable Chest Press', muscle: 'Chest' },
  { name: 'Cable Crossover', muscle: 'Chest' },
  { name: 'Decline Cable Fly', muscle: 'Chest' },
  { name: 'High to Low Cable Fly', muscle: 'Chest' },
  { name: 'Incline Cable Fly', muscle: 'Chest' },
  { name: 'Low to High Cable Fly', muscle: 'Chest' },
  { name: 'Single Arm Cable Crossover', muscle: 'Chest' },
  // Machine
  { name: 'Iso-Lateral Chest Press', muscle: 'Chest' },
  { name: 'Machine Chest Press', muscle: 'Chest' },
  { name: 'Pec Deck', muscle: 'Chest' },
  { name: 'Smith Machine Bench Press', muscle: 'Chest' },
  // Bodyweight
  { name: 'Archer Push Up', muscle: 'Chest' },
  { name: 'Banded Push Up', muscle: 'Chest' },
  { name: 'Chest Dips', muscle: 'Chest' },
  { name: 'Decline Push Up', muscle: 'Chest' },
  { name: 'Diamond Push Up', muscle: 'Chest' },
  { name: 'Incline Push Up', muscle: 'Chest' },
  { name: 'Plyometric Push Up', muscle: 'Chest' },
  { name: 'Push Up', muscle: 'Chest' },
  { name: 'Ring Push Up', muscle: 'Chest' },
  { name: 'Weighted Push Up', muscle: 'Chest' },
  { name: 'Wide Push Up', muscle: 'Chest' },
  // Other
  { name: 'Landmine Press', muscle: 'Chest' },

  // ── BACK ──────────────────────────────────────────────────────────────────
  // Barbell / Deadlift variations
  { name: 'Deadlift', muscle: 'Back' },
  { name: 'Good Morning', muscle: 'Back' },
  { name: 'Jefferson Curl', muscle: 'Back' },
  { name: 'Rack Pull', muscle: 'Back' },
  { name: 'Romanian Deadlift', muscle: 'Back' },
  { name: 'Single Leg Romanian Deadlift', muscle: 'Back' },
  { name: 'Snatch Grip Deadlift', muscle: 'Back' },
  { name: 'Stiff Leg Deadlift', muscle: 'Back' },
  { name: 'Sumo Deadlift', muscle: 'Back' },
  { name: 'Trap Bar Deadlift', muscle: 'Back' },
  // Barbell rows
  { name: 'Barbell Shrug', muscle: 'Back' },
  { name: 'Bent Over Barbell Row', muscle: 'Back' },
  { name: 'Pendlay Row', muscle: 'Back' },
  { name: 'Reverse Grip Bent Over Row', muscle: 'Back' },
  // Dumbbell
  { name: 'Chest Supported Row', muscle: 'Back' },
  { name: 'Dumbbell Shrug', muscle: 'Back' },
  { name: 'Kneeling Single Arm Row', muscle: 'Back' },
  { name: 'Meadows Row', muscle: 'Back' },
  { name: 'Prone Row', muscle: 'Back' },
  { name: 'Renegade Row', muscle: 'Back' },
  { name: 'Seal Row', muscle: 'Back' },
  { name: 'Single Arm Dumbbell Row', muscle: 'Back' },
  // Cable
  { name: 'Cable Pullover', muscle: 'Back' },
  { name: 'Cable Shrug', muscle: 'Back' },
  { name: 'Close Grip Lat Pulldown', muscle: 'Back' },
  { name: 'Face Pull', muscle: 'Back' },
  { name: 'Lat Pulldown', muscle: 'Back' },
  { name: 'Low Cable Row', muscle: 'Back' },
  { name: 'Seated Cable Row', muscle: 'Back' },
  { name: 'Single Arm Cable Row', muscle: 'Back' },
  { name: 'Single Arm Pulldown', muscle: 'Back' },
  { name: 'Straight Arm Pulldown', muscle: 'Back' },
  { name: 'V-Bar Pulldown', muscle: 'Back' },
  { name: 'Wide Grip Lat Pulldown', muscle: 'Back' },
  // Machine
  { name: 'Machine Row', muscle: 'Back' },
  { name: 'T-Bar Row', muscle: 'Back' },
  { name: 'Trap Bar Shrug', muscle: 'Back' },
  // Bodyweight
  { name: 'Assisted Pull Up', muscle: 'Back' },
  { name: 'Behind the Neck Pull Up', muscle: 'Back' },
  { name: 'Bird Dog', muscle: 'Back' },
  { name: 'Chin Up', muscle: 'Back' },
  { name: 'Hyperextension', muscle: 'Back' },
  { name: 'Inverted Row', muscle: 'Back' },
  { name: 'Neutral Grip Pull Up', muscle: 'Back' },
  { name: 'Pull Up', muscle: 'Back' },
  { name: 'Ring Row', muscle: 'Back' },
  { name: 'Superman', muscle: 'Back' },
  { name: 'TRX Row', muscle: 'Back' },
  { name: 'Wide Grip Pull Up', muscle: 'Back' },

  // ── LEGS ──────────────────────────────────────────────────────────────────
  // Squat variations
  { name: 'Box Squat', muscle: 'Legs' },
  { name: 'Bulgarian Split Squat', muscle: 'Legs' },
  { name: 'Front Squat', muscle: 'Legs' },
  { name: 'Goblet Squat', muscle: 'Legs' },
  { name: 'Hack Squat', muscle: 'Legs' },
  { name: 'Kneeling Squat', muscle: 'Legs' },
  { name: 'Landmine Squat', muscle: 'Legs' },
  { name: 'Pause Squat', muscle: 'Legs' },
  { name: 'Pendulum Squat', muscle: 'Legs' },
  { name: 'Pistol Squat', muscle: 'Legs' },
  { name: 'Romanian Split Squat', muscle: 'Legs' },
  { name: 'Single Leg Squat', muscle: 'Legs' },
  { name: 'Sissy Squat', muscle: 'Legs' },
  { name: 'Smith Machine Squat', muscle: 'Legs' },
  { name: 'Squat', muscle: 'Legs' },
  { name: 'Sumo Squat', muscle: 'Legs' },
  { name: 'Wall Sit', muscle: 'Legs' },
  { name: 'Zercher Squat', muscle: 'Legs' },
  // Lunge variations
  { name: 'Curtsy Lunge', muscle: 'Legs' },
  { name: 'Jumping Lunge', muscle: 'Legs' },
  { name: 'Lateral Lunge', muscle: 'Legs' },
  { name: 'Lunges', muscle: 'Legs' },
  { name: 'Reverse Lunge', muscle: 'Legs' },
  { name: 'Smith Machine Lunge', muscle: 'Legs' },
  { name: 'Walking Lunges', muscle: 'Legs' },
  // Hip / Glute
  { name: 'Banded Hip Thrust', muscle: 'Legs' },
  { name: 'Barbell Hip Thrust', muscle: 'Legs' },
  { name: 'Cable Kickback', muscle: 'Legs' },
  { name: 'Cable Pull Through', muscle: 'Legs' },
  { name: 'Donkey Kick', muscle: 'Legs' },
  { name: 'Fire Hydrant', muscle: 'Legs' },
  { name: 'Frog Pump', muscle: 'Legs' },
  { name: 'Glute Bridge', muscle: 'Legs' },
  { name: 'Hip Abduction', muscle: 'Legs' },
  { name: 'Hip Adduction', muscle: 'Legs' },
  { name: 'Hip Thrust', muscle: 'Legs' },
  { name: 'Single Leg Glute Bridge', muscle: 'Legs' },
  // Hamstring / knee
  { name: 'Glute Ham Raise', muscle: 'Legs' },
  { name: 'Leg Curl', muscle: 'Legs' },
  { name: 'Leg Extension', muscle: 'Legs' },
  { name: 'Lying Leg Curl', muscle: 'Legs' },
  { name: 'Nordic Curl', muscle: 'Legs' },
  { name: 'Reverse Hyper', muscle: 'Legs' },
  // Press
  { name: 'Leg Press', muscle: 'Legs' },
  { name: 'Single Leg Press', muscle: 'Legs' },
  // Step / carry
  { name: 'Box Step Up', muscle: 'Legs' },
  { name: 'Lateral Band Walk', muscle: 'Legs' },
  { name: 'Monster Walk', muscle: 'Legs' },
  { name: 'Step Up', muscle: 'Legs' },
  // Calf
  { name: 'Calf Raise', muscle: 'Legs' },
  { name: 'Heel Walk', muscle: 'Legs' },
  { name: 'Leg Press Calf Raise', muscle: 'Legs' },
  { name: 'Seated Calf Raise', muscle: 'Legs' },
  { name: 'Tibialis Raise', muscle: 'Legs' },
  { name: 'Toe Walk', muscle: 'Legs' },

  // ── SHOULDERS ─────────────────────────────────────────────────────────────
  // Press
  { name: 'Arnold Press', muscle: 'Shoulders' },
  { name: 'Behind the Neck Press', muscle: 'Shoulders' },
  { name: 'Bradford Press', muscle: 'Shoulders' },
  { name: 'Dumbbell Shoulder Press', muscle: 'Shoulders' },
  { name: 'Half Kneeling Press', muscle: 'Shoulders' },
  { name: 'Machine Shoulder Press', muscle: 'Shoulders' },
  { name: 'Overhead Press', muscle: 'Shoulders' },
  { name: 'Push Press', muscle: 'Shoulders' },
  { name: 'Scott Press', muscle: 'Shoulders' },
  { name: 'Seated Barbell Press', muscle: 'Shoulders' },
  { name: 'Seated Dumbbell Press', muscle: 'Shoulders' },
  { name: 'Smith Machine Shoulder Press', muscle: 'Shoulders' },
  { name: 'Z-Press', muscle: 'Shoulders' },
  // Raises — lateral
  { name: 'Cable Lateral Raise', muscle: 'Shoulders' },
  { name: 'Lateral Raise', muscle: 'Shoulders' },
  { name: 'Leaning Lateral Raise', muscle: 'Shoulders' },
  { name: 'Machine Lateral Raise', muscle: 'Shoulders' },
  // Raises — front
  { name: 'Cable Front Raise', muscle: 'Shoulders' },
  { name: 'Front Raise', muscle: 'Shoulders' },
  { name: 'Lu Raise', muscle: 'Shoulders' },
  { name: 'Plate Front Raise', muscle: 'Shoulders' },
  // Raises — rear
  { name: 'Bent Over Lateral Raise', muscle: 'Shoulders' },
  { name: 'Cable Rear Delt Fly', muscle: 'Shoulders' },
  { name: 'Cable Y Raise', muscle: 'Shoulders' },
  { name: 'Machine Rear Delt Fly', muscle: 'Shoulders' },
  { name: 'Rear Delt Fly', muscle: 'Shoulders' },
  { name: 'Y-T-W Raises', muscle: 'Shoulders' },
  // Upright rows / other
  { name: 'Band Pull Apart', muscle: 'Shoulders' },
  { name: 'Cable Upright Row', muscle: 'Shoulders' },
  { name: 'Cuban Press', muscle: 'Shoulders' },
  { name: 'Dumbbell Upright Row', muscle: 'Shoulders' },
  { name: 'Landmine Lateral Raise', muscle: 'Shoulders' },
  { name: 'Upright Row', muscle: 'Shoulders' },
  // Bodyweight
  { name: 'Handstand Push Up', muscle: 'Shoulders' },
  { name: 'Pike Push Up', muscle: 'Shoulders' },

  // ── ARMS ──────────────────────────────────────────────────────────────────
  // Bicep — barbell
  { name: 'Barbell Curl', muscle: 'Arms' },
  { name: 'EZ Bar Curl', muscle: 'Arms' },
  { name: 'Reverse Curl', muscle: 'Arms' },
  // Bicep — dumbbell
  { name: 'Bayesian Curl', muscle: 'Arms' },
  { name: 'Bicep Curl', muscle: 'Arms' },
  { name: 'Concentration Curl', muscle: 'Arms' },
  { name: 'Cross Body Curl', muscle: 'Arms' },
  { name: 'Drag Curl', muscle: 'Arms' },
  { name: 'Hammer Curl', muscle: 'Arms' },
  { name: 'Incline Dumbbell Curl', muscle: 'Arms' },
  { name: 'Pinwheel Curl', muscle: 'Arms' },
  { name: 'Seated Incline Curl', muscle: 'Arms' },
  { name: 'Spider Curl', muscle: 'Arms' },
  { name: 'Zottman Curl', muscle: 'Arms' },
  // Bicep — cable
  { name: 'Cable Curl', muscle: 'Arms' },
  { name: 'Cable Hammer Curl', muscle: 'Arms' },
  { name: 'High Cable Curl', muscle: 'Arms' },
  { name: 'Rope Curl', muscle: 'Arms' },
  // Bicep — machine
  { name: 'Machine Bicep Curl', muscle: 'Arms' },
  { name: 'Preacher Curl', muscle: 'Arms' },
  // Misc bicep
  { name: '21s', muscle: 'Arms' },
  { name: 'Wrist Curl', muscle: 'Arms' },
  { name: 'Reverse Wrist Curl', muscle: 'Arms' },
  // Tricep — barbell
  { name: 'French Press', muscle: 'Arms' },
  { name: 'JM Press', muscle: 'Arms' },
  { name: 'Skull Crusher', muscle: 'Arms' },
  // Tricep — dumbbell
  { name: 'Dumbbell Overhead Extension', muscle: 'Arms' },
  { name: 'Rolling Tricep Extension', muscle: 'Arms' },
  { name: 'Single Arm Overhead Extension', muscle: 'Arms' },
  { name: 'Tate Press', muscle: 'Arms' },
  { name: 'Tricep Kickback', muscle: 'Arms' },
  // Tricep — cable
  { name: 'Cable Overhead Tricep Extension', muscle: 'Arms' },
  { name: 'Overhead Tricep Extension', muscle: 'Arms' },
  { name: 'Rope Pushdown', muscle: 'Arms' },
  { name: 'Single Arm Tricep Pushdown', muscle: 'Arms' },
  { name: 'Tricep Pushdown', muscle: 'Arms' },
  // Tricep — machine / bodyweight
  { name: 'Bench Dips', muscle: 'Arms' },
  { name: 'Machine Tricep Extension', muscle: 'Arms' },
  { name: 'Tricep Dips', muscle: 'Arms' },
  { name: 'Weighted Tricep Dips', muscle: 'Arms' },

  // ── CORE ──────────────────────────────────────────────────────────────────
  // Plank variations
  { name: 'Copenhagen Plank', muscle: 'Core' },
  { name: 'Hollow Body Hold', muscle: 'Core' },
  { name: 'Hollow Rock', muscle: 'Core' },
  { name: 'L-Sit', muscle: 'Core' },
  { name: 'Plank', muscle: 'Core' },
  { name: 'Plank Hip Dip', muscle: 'Core' },
  { name: 'RKC Plank', muscle: 'Core' },
  { name: 'Side Plank', muscle: 'Core' },
  // Crunch / sit up variations
  { name: 'Bicycle Crunch', muscle: 'Core' },
  { name: 'Cable Crunch', muscle: 'Core' },
  { name: 'Crunch', muscle: 'Core' },
  { name: 'GHD Sit Up', muscle: 'Core' },
  { name: 'Landmine Crunch', muscle: 'Core' },
  { name: 'Oblique Crunch', muscle: 'Core' },
  { name: 'Reverse Crunch', muscle: 'Core' },
  { name: 'Seated Ab Machine', muscle: 'Core' },
  { name: 'Sit Up', muscle: 'Core' },
  { name: 'Stability Ball Crunch', muscle: 'Core' },
  { name: 'Toe Touch', muscle: 'Core' },
  // Leg raise variations
  { name: 'Dragon Flag', muscle: 'Core' },
  { name: 'Flutter Kicks', muscle: 'Core' },
  { name: 'Hanging Knee Raise', muscle: 'Core' },
  { name: 'Hanging Leg Raise', muscle: 'Core' },
  { name: 'Leg Raise', muscle: 'Core' },
  { name: 'Scissor Kicks', muscle: 'Core' },
  { name: 'Toes to Bar', muscle: 'Core' },
  { name: 'V-Up', muscle: 'Core' },
  // Rotation / anti-rotation
  { name: 'Landmine Rotation', muscle: 'Core' },
  { name: 'Pallof Press', muscle: 'Core' },
  { name: 'Russian Twist', muscle: 'Core' },
  { name: 'Side Bend', muscle: 'Core' },
  { name: 'Windshield Wiper', muscle: 'Core' },
  { name: 'Woodchop', muscle: 'Core' },
  // Rollouts
  { name: 'Ab Wheel Rollout', muscle: 'Core' },
  { name: 'Barbell Rollout', muscle: 'Core' },
  { name: 'Stir the Pot', muscle: 'Core' },
  { name: 'Swiss Ball Rollout', muscle: 'Core' },
  { name: 'TRX Fallout', muscle: 'Core' },
  // Functional / carry
  { name: 'Bear Crawl', muscle: 'Core' },
  { name: 'Dead Bug', muscle: 'Core' },
  { name: 'Inchworm', muscle: 'Core' },
  { name: 'Mountain Climber', muscle: 'Core' },
  { name: 'Suitcase Carry', muscle: 'Core' },
  { name: 'Waiter\'s Walk', muscle: 'Core' },

  // ── CARDIO / FULL BODY ────────────────────────────────────────────────────
  // Jumps / plyometrics
  { name: 'Box Jump', muscle: 'Cardio' },
  { name: 'Broad Jump', muscle: 'Cardio' },
  { name: 'Depth Jump', muscle: 'Cardio' },
  { name: 'Jump Squat', muscle: 'Cardio' },
  { name: 'Jumping Jacks', muscle: 'Cardio' },
  { name: 'Lateral Bound', muscle: 'Cardio' },
  { name: 'Plyometric Push Up', muscle: 'Cardio' },
  { name: 'Skater Jump', muscle: 'Cardio' },
  { name: 'Tuck Jump', muscle: 'Cardio' },
  // Running / sprinting
  { name: 'Band Sprint', muscle: 'Cardio' },
  { name: 'High Knees', muscle: 'Cardio' },
  { name: 'Lateral Shuffle', muscle: 'Cardio' },
  { name: 'Power Skip', muscle: 'Cardio' },
  { name: 'Shuttle Run', muscle: 'Cardio' },
  { name: 'Sprint', muscle: 'Cardio' },
  // Jump rope
  { name: 'Double Unders', muscle: 'Cardio' },
  { name: 'Jump Rope', muscle: 'Cardio' },
  // Burpee / full body
  { name: 'Burpees', muscle: 'Cardio' },
  { name: 'Jumping Lunge', muscle: 'Cardio' },
  { name: 'Man Maker', muscle: 'Cardio' },
  { name: 'Squat Thrust', muscle: 'Cardio' },
  // Sleds / carries
  { name: 'Farmer\'s Walk', muscle: 'Cardio' },
  { name: 'Sandbag Carry', muscle: 'Cardio' },
  { name: 'Sled March', muscle: 'Cardio' },
  { name: 'Sled Pull', muscle: 'Cardio' },
  { name: 'Sled Push', muscle: 'Cardio' },
  // Battle ropes / bags
  { name: 'Battle Ropes', muscle: 'Cardio' },
  { name: 'Medicine Ball Slam', muscle: 'Cardio' },
  { name: 'Rotational Medicine Ball Throw', muscle: 'Cardio' },
  { name: 'Tire Flip', muscle: 'Cardio' },
  { name: 'Wall Ball', muscle: 'Cardio' },
  // Kettlebell
  { name: 'Kettlebell Clean', muscle: 'Cardio' },
  { name: 'Kettlebell Snatch', muscle: 'Cardio' },
  { name: 'Kettlebell Swing', muscle: 'Cardio' },
  { name: 'Turkish Get Up', muscle: 'Cardio' },
  // Olympic / barbell
  { name: 'Clean and Jerk', muscle: 'Cardio' },
  { name: 'Dumbbell Thruster', muscle: 'Cardio' },
  { name: 'Hang Clean', muscle: 'Cardio' },
  { name: 'Power Clean', muscle: 'Cardio' },
  { name: 'Thruster', muscle: 'Cardio' },
  // Agility
  { name: 'Agility Ladder', muscle: 'Cardio' },
  { name: 'Cone Drill', muscle: 'Cardio' },
  { name: 'Explosive Step Up', muscle: 'Cardio' },
  // Combat
  { name: 'Shadow Boxing', muscle: 'Cardio' },
  // Machines / steady state
  { name: 'Assault Bike', muscle: 'Cardio' },
  { name: 'Elliptical', muscle: 'Cardio' },
  { name: 'Rowing Machine', muscle: 'Cardio' },
  { name: 'Stair Climber', muscle: 'Cardio' },
  { name: 'Stationary Bike', muscle: 'Cardio' },
  { name: 'Swimming', muscle: 'Cardio' },
  { name: 'Treadmill Run', muscle: 'Cardio' },
  { name: 'Versa Climber', muscle: 'Cardio' },
  { name: 'Walking', muscle: 'Cardio' },
];
