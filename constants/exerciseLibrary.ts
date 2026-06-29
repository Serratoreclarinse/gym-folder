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
  primary: string;
  secondary: string[];
};

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core', 'Cardio',
];

export const EXERCISE_LIBRARY: LibraryExercise[] = [

  // ── CHEST ─────────────────────────────────────────────────────────────────
  // Barbell
  { name: 'Bench Press',              muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Front Delts'] },
  { name: 'Close Grip Bench Press',   muscle: 'Chest', primary: 'Triceps',     secondary: ['Mid Chest', 'Front Delts'] },
  { name: 'Decline Bench Press',      muscle: 'Chest', primary: 'Lower Chest', secondary: ['Triceps', 'Front Delts'] },
  { name: 'Floor Press',              muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps'] },
  { name: 'Guillotine Press',         muscle: 'Chest', primary: 'Upper Chest', secondary: ['Front Delts'] },
  { name: 'Incline Bench Press',      muscle: 'Chest', primary: 'Upper Chest', secondary: ['Triceps', 'Front Delts'] },
  { name: 'Reverse Grip Bench Press', muscle: 'Chest', primary: 'Upper Chest', secondary: ['Triceps'] },
  { name: 'Spoto Press',              muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Front Delts'] },
  // Dumbbell
  { name: 'Chest Fly',                muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Front Delts', 'Biceps'] },
  { name: 'Decline Dumbbell Press',   muscle: 'Chest', primary: 'Lower Chest', secondary: ['Triceps', 'Front Delts'] },
  { name: 'Dumbbell Chest Press',     muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Front Delts'] },
  { name: 'Dumbbell Floor Press',     muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps'] },
  { name: 'Dumbbell Pullover',        muscle: 'Chest', primary: 'Chest',       secondary: ['Lats', 'Triceps'] },
  { name: 'Hex Press',                muscle: 'Chest', primary: 'Inner Chest', secondary: ['Triceps'] },
  { name: 'Incline Chest Fly',        muscle: 'Chest', primary: 'Upper Chest', secondary: ['Front Delts'] },
  { name: 'Incline Dumbbell Press',   muscle: 'Chest', primary: 'Upper Chest', secondary: ['Triceps', 'Front Delts'] },
  { name: 'Neutral Grip Dumbbell Press', muscle: 'Chest', primary: 'Mid Chest', secondary: ['Triceps', 'Front Delts'] },
  { name: 'Squeeze Press',            muscle: 'Chest', primary: 'Inner Chest', secondary: ['Triceps'] },
  { name: 'Svend Press',              muscle: 'Chest', primary: 'Inner Chest', secondary: ['Front Delts'] },
  // Cable
  { name: 'Cable Chest Press',        muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Front Delts'] },
  { name: 'Cable Crossover',          muscle: 'Chest', primary: 'Inner Chest', secondary: ['Front Delts'] },
  { name: 'Decline Cable Fly',        muscle: 'Chest', primary: 'Lower Chest', secondary: ['Front Delts'] },
  { name: 'High to Low Cable Fly',    muscle: 'Chest', primary: 'Lower Chest', secondary: ['Front Delts'] },
  { name: 'Incline Cable Fly',        muscle: 'Chest', primary: 'Upper Chest', secondary: ['Front Delts'] },
  { name: 'Low to High Cable Fly',    muscle: 'Chest', primary: 'Upper Chest', secondary: ['Front Delts'] },
  { name: 'Single Arm Cable Crossover', muscle: 'Chest', primary: 'Inner Chest', secondary: ['Front Delts', 'Core'] },
  // Machine
  { name: 'Iso-Lateral Chest Press',  muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Front Delts'] },
  { name: 'Machine Chest Press',      muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Front Delts'] },
  { name: 'Pec Deck',                 muscle: 'Chest', primary: 'Inner Chest', secondary: ['Front Delts'] },
  { name: 'Smith Machine Bench Press',muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Front Delts'] },
  // Bodyweight
  { name: 'Archer Push Up',           muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Core'] },
  { name: 'Banded Push Up',           muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Front Delts'] },
  { name: 'Chest Dips',               muscle: 'Chest', primary: 'Lower Chest', secondary: ['Triceps', 'Front Delts'] },
  { name: 'Decline Push Up',          muscle: 'Chest', primary: 'Upper Chest', secondary: ['Triceps', 'Front Delts'] },
  { name: 'Diamond Push Up',          muscle: 'Chest', primary: 'Triceps',     secondary: ['Inner Chest', 'Front Delts'] },
  { name: 'Incline Push Up',          muscle: 'Chest', primary: 'Lower Chest', secondary: ['Triceps', 'Front Delts'] },
  { name: 'Plyometric Push Up',       muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Core'] },
  { name: 'Push Up',                  muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Front Delts'] },
  { name: 'Ring Push Up',             muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Core'] },
  { name: 'Weighted Push Up',         muscle: 'Chest', primary: 'Mid Chest',   secondary: ['Triceps', 'Front Delts'] },
  { name: 'Wide Push Up',             muscle: 'Chest', primary: 'Outer Chest', secondary: ['Front Delts'] },
  // Other
  { name: 'Landmine Press',           muscle: 'Chest', primary: 'Upper Chest', secondary: ['Front Delts', 'Triceps'] },

  // ── BACK ──────────────────────────────────────────────────────────────────
  // Deadlift variations
  { name: 'Deadlift',                 muscle: 'Back', primary: 'Lower Back',  secondary: ['Hamstrings', 'Glutes', 'Traps'] },
  { name: 'Good Morning',             muscle: 'Back', primary: 'Erectors',    secondary: ['Hamstrings', 'Glutes'] },
  { name: 'Jefferson Curl',           muscle: 'Back', primary: 'Erectors',    secondary: ['Hamstrings'] },
  { name: 'Rack Pull',                muscle: 'Back', primary: 'Traps',       secondary: ['Lower Back', 'Hamstrings'] },
  { name: 'Romanian Deadlift',        muscle: 'Back', primary: 'Hamstrings',  secondary: ['Glutes', 'Lower Back'] },
  { name: 'Single Leg Romanian Deadlift', muscle: 'Back', primary: 'Hamstrings', secondary: ['Glutes', 'Core'] },
  { name: 'Snatch Grip Deadlift',     muscle: 'Back', primary: 'Traps',       secondary: ['Lower Back', 'Hamstrings'] },
  { name: 'Stiff Leg Deadlift',       muscle: 'Back', primary: 'Hamstrings',  secondary: ['Lower Back', 'Glutes'] },
  { name: 'Sumo Deadlift',            muscle: 'Back', primary: 'Glutes',      secondary: ['Hamstrings', 'Adductors', 'Traps'] },
  { name: 'Trap Bar Deadlift',        muscle: 'Back', primary: 'Glutes',      secondary: ['Quads', 'Hamstrings', 'Traps'] },
  // Barbell rows / shrugs
  { name: 'Barbell Shrug',            muscle: 'Back', primary: 'Traps',       secondary: ['Rhomboids'] },
  { name: 'Bent Over Barbell Row',    muscle: 'Back', primary: 'Lats',        secondary: ['Rhomboids', 'Biceps', 'Rear Delts'] },
  { name: 'Pendlay Row',              muscle: 'Back', primary: 'Lats',        secondary: ['Rhomboids', 'Biceps'] },
  { name: 'Reverse Grip Bent Over Row', muscle: 'Back', primary: 'Lats',     secondary: ['Biceps', 'Rhomboids'] },
  // Dumbbell
  { name: 'Chest Supported Row',      muscle: 'Back', primary: 'Rhomboids',   secondary: ['Lats', 'Rear Delts', 'Biceps'] },
  { name: 'Dumbbell Shrug',           muscle: 'Back', primary: 'Traps',       secondary: ['Rhomboids'] },
  { name: 'Kneeling Single Arm Row',  muscle: 'Back', primary: 'Lats',        secondary: ['Rhomboids', 'Biceps'] },
  { name: 'Meadows Row',              muscle: 'Back', primary: 'Lats',        secondary: ['Rhomboids', 'Rear Delts', 'Biceps'] },
  { name: 'Prone Row',                muscle: 'Back', primary: 'Rhomboids',   secondary: ['Rear Delts', 'Lats'] },
  { name: 'Renegade Row',             muscle: 'Back', primary: 'Lats',        secondary: ['Core', 'Triceps'] },
  { name: 'Seal Row',                 muscle: 'Back', primary: 'Rhomboids',   secondary: ['Lats', 'Rear Delts', 'Biceps'] },
  { name: 'Single Arm Dumbbell Row',  muscle: 'Back', primary: 'Lats',        secondary: ['Rhomboids', 'Biceps'] },
  // Cable
  { name: 'Cable Pullover',           muscle: 'Back', primary: 'Lats',        secondary: ['Chest', 'Triceps'] },
  { name: 'Cable Shrug',              muscle: 'Back', primary: 'Traps',       secondary: ['Rhomboids'] },
  { name: 'Close Grip Lat Pulldown',  muscle: 'Back', primary: 'Lats',        secondary: ['Biceps', 'Rhomboids'] },
  { name: 'Face Pull',                muscle: 'Back', primary: 'Rear Delts',  secondary: ['Rhomboids', 'Rotator Cuff'] },
  { name: 'Lat Pulldown',             muscle: 'Back', primary: 'Lats',        secondary: ['Biceps', 'Rhomboids'] },
  { name: 'Low Cable Row',            muscle: 'Back', primary: 'Lats',        secondary: ['Rhomboids', 'Biceps'] },
  { name: 'Seated Cable Row',         muscle: 'Back', primary: 'Lats',        secondary: ['Rhomboids', 'Biceps'] },
  { name: 'Single Arm Cable Row',     muscle: 'Back', primary: 'Lats',        secondary: ['Rhomboids', 'Biceps'] },
  { name: 'Single Arm Pulldown',      muscle: 'Back', primary: 'Lats',        secondary: ['Biceps', 'Core'] },
  { name: 'Straight Arm Pulldown',    muscle: 'Back', primary: 'Lats',        secondary: ['Core'] },
  { name: 'V-Bar Pulldown',           muscle: 'Back', primary: 'Lats',        secondary: ['Biceps', 'Rhomboids'] },
  { name: 'Wide Grip Lat Pulldown',   muscle: 'Back', primary: 'Lats',        secondary: ['Biceps', 'Teres Major'] },
  // Machine
  { name: 'Machine Row',              muscle: 'Back', primary: 'Rhomboids',   secondary: ['Lats', 'Rear Delts', 'Biceps'] },
  { name: 'T-Bar Row',                muscle: 'Back', primary: 'Lats',        secondary: ['Rhomboids', 'Rear Delts', 'Biceps'] },
  { name: 'Trap Bar Shrug',           muscle: 'Back', primary: 'Traps',       secondary: ['Rhomboids'] },
  // Bodyweight
  { name: 'Assisted Pull Up',         muscle: 'Back', primary: 'Lats',        secondary: ['Biceps', 'Rhomboids'] },
  { name: 'Behind the Neck Pull Up',  muscle: 'Back', primary: 'Lats',        secondary: ['Rhomboids', 'Rear Delts'] },
  { name: 'Bird Dog',                 muscle: 'Back', primary: 'Erectors',    secondary: ['Glutes', 'Core'] },
  { name: 'Chin Up',                  muscle: 'Back', primary: 'Lats',        secondary: ['Biceps', 'Rhomboids'] },
  { name: 'Hyperextension',           muscle: 'Back', primary: 'Erectors',    secondary: ['Glutes', 'Hamstrings'] },
  { name: 'Inverted Row',             muscle: 'Back', primary: 'Rhomboids',   secondary: ['Lats', 'Biceps', 'Core'] },
  { name: 'Neutral Grip Pull Up',     muscle: 'Back', primary: 'Lats',        secondary: ['Biceps', 'Brachialis'] },
  { name: 'Pull Up',                  muscle: 'Back', primary: 'Lats',        secondary: ['Biceps', 'Rhomboids'] },
  { name: 'Ring Row',                 muscle: 'Back', primary: 'Rhomboids',   secondary: ['Lats', 'Biceps', 'Core'] },
  { name: 'Superman',                 muscle: 'Back', primary: 'Erectors',    secondary: ['Glutes', 'Hamstrings'] },
  { name: 'TRX Row',                  muscle: 'Back', primary: 'Rhomboids',   secondary: ['Lats', 'Biceps', 'Core'] },
  { name: 'Wide Grip Pull Up',        muscle: 'Back', primary: 'Lats',        secondary: ['Rhomboids', 'Rear Delts'] },

  // ── LEGS ──────────────────────────────────────────────────────────────────
  // Squat variations
  { name: 'Box Squat',                muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Hamstrings'] },
  { name: 'Bulgarian Split Squat',    muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Hamstrings'] },
  { name: 'Front Squat',              muscle: 'Legs', primary: 'Quads',       secondary: ['Core', 'Glutes'] },
  { name: 'Goblet Squat',             muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Core'] },
  { name: 'Hack Squat',               muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Hamstrings'] },
  { name: 'Kneeling Squat',           muscle: 'Legs', primary: 'Glutes',      secondary: ['Quads', 'Hamstrings'] },
  { name: 'Landmine Squat',           muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Core'] },
  { name: 'Pause Squat',              muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Hamstrings'] },
  { name: 'Pendulum Squat',           muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes'] },
  { name: 'Pistol Squat',             muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Core', 'Calves'] },
  { name: 'Romanian Split Squat',     muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Hamstrings'] },
  { name: 'Single Leg Squat',         muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Core'] },
  { name: 'Sissy Squat',              muscle: 'Legs', primary: 'Quads',       secondary: ['Calves'] },
  { name: 'Smith Machine Squat',      muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Hamstrings'] },
  { name: 'Squat',                    muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Hamstrings'] },
  { name: 'Sumo Squat',               muscle: 'Legs', primary: 'Glutes',      secondary: ['Adductors', 'Quads'] },
  { name: 'Wall Sit',                 muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Calves'] },
  { name: 'Zercher Squat',            muscle: 'Legs', primary: 'Quads',       secondary: ['Core', 'Glutes', 'Upper Back'] },
  // Lunge variations
  { name: 'Curtsy Lunge',             muscle: 'Legs', primary: 'Glutes',      secondary: ['Adductors', 'Quads'] },
  { name: 'Jumping Lunge',            muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Calves'] },
  { name: 'Lateral Lunge',            muscle: 'Legs', primary: 'Adductors',   secondary: ['Quads', 'Glutes'] },
  { name: 'Lunges',                   muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Hamstrings'] },
  { name: 'Reverse Lunge',            muscle: 'Legs', primary: 'Glutes',      secondary: ['Quads', 'Hamstrings'] },
  { name: 'Smith Machine Lunge',      muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes'] },
  { name: 'Walking Lunges',           muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Hamstrings'] },
  // Hip / Glute
  { name: 'Banded Hip Thrust',        muscle: 'Legs', primary: 'Glutes',      secondary: ['Hamstrings', 'Core'] },
  { name: 'Barbell Hip Thrust',       muscle: 'Legs', primary: 'Glutes',      secondary: ['Hamstrings', 'Core'] },
  { name: 'Cable Kickback',           muscle: 'Legs', primary: 'Glutes',      secondary: ['Hamstrings'] },
  { name: 'Cable Pull Through',       muscle: 'Legs', primary: 'Glutes',      secondary: ['Hamstrings', 'Lower Back'] },
  { name: 'Donkey Kick',              muscle: 'Legs', primary: 'Glutes',      secondary: ['Hamstrings'] },
  { name: 'Fire Hydrant',             muscle: 'Legs', primary: 'Glutes',      secondary: ['Abductors'] },
  { name: 'Frog Pump',                muscle: 'Legs', primary: 'Glutes',      secondary: ['Adductors'] },
  { name: 'Glute Bridge',             muscle: 'Legs', primary: 'Glutes',      secondary: ['Hamstrings', 'Core'] },
  { name: 'Hip Abduction',            muscle: 'Legs', primary: 'Abductors',   secondary: ['Glutes'] },
  { name: 'Hip Adduction',            muscle: 'Legs', primary: 'Adductors',   secondary: ['Glutes'] },
  { name: 'Hip Thrust',               muscle: 'Legs', primary: 'Glutes',      secondary: ['Hamstrings'] },
  { name: 'Single Leg Glute Bridge',  muscle: 'Legs', primary: 'Glutes',      secondary: ['Hamstrings', 'Core'] },
  // Hamstring / knee
  { name: 'Glute Ham Raise',          muscle: 'Legs', primary: 'Hamstrings',  secondary: ['Glutes', 'Calves'] },
  { name: 'Leg Curl',                 muscle: 'Legs', primary: 'Hamstrings',  secondary: ['Glutes', 'Calves'] },
  { name: 'Leg Extension',            muscle: 'Legs', primary: 'Quads',       secondary: [] },
  { name: 'Lying Leg Curl',           muscle: 'Legs', primary: 'Hamstrings',  secondary: ['Calves', 'Glutes'] },
  { name: 'Nordic Curl',              muscle: 'Legs', primary: 'Hamstrings',  secondary: ['Glutes', 'Calves'] },
  { name: 'Reverse Hyper',            muscle: 'Legs', primary: 'Glutes',      secondary: ['Hamstrings', 'Lower Back'] },
  // Press
  { name: 'Leg Press',                muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Hamstrings'] },
  { name: 'Single Leg Press',         muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Hamstrings'] },
  // Step / carry
  { name: 'Box Step Up',              muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Calves'] },
  { name: 'Lateral Band Walk',        muscle: 'Legs', primary: 'Abductors',   secondary: ['Glutes'] },
  { name: 'Monster Walk',             muscle: 'Legs', primary: 'Abductors',   secondary: ['Glutes', 'Quads'] },
  { name: 'Step Up',                  muscle: 'Legs', primary: 'Quads',       secondary: ['Glutes', 'Calves'] },
  // Calf
  { name: 'Calf Raise',               muscle: 'Legs', primary: 'Calves',      secondary: [] },
  { name: 'Heel Walk',                muscle: 'Legs', primary: 'Tibialis',    secondary: [] },
  { name: 'Leg Press Calf Raise',     muscle: 'Legs', primary: 'Calves',      secondary: [] },
  { name: 'Seated Calf Raise',        muscle: 'Legs', primary: 'Soleus',      secondary: ['Calves'] },
  { name: 'Tibialis Raise',           muscle: 'Legs', primary: 'Tibialis',    secondary: [] },
  { name: 'Toe Walk',                 muscle: 'Legs', primary: 'Calves',      secondary: ['Tibialis'] },

  // ── SHOULDERS ─────────────────────────────────────────────────────────────
  // Press
  { name: 'Arnold Press',             muscle: 'Shoulders', primary: 'Front Delts', secondary: ['Side Delts', 'Triceps'] },
  { name: 'Behind the Neck Press',    muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Rear Delts', 'Triceps'] },
  { name: 'Bradford Press',           muscle: 'Shoulders', primary: 'Front Delts', secondary: ['Side Delts', 'Triceps'] },
  { name: 'Dumbbell Shoulder Press',  muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Front Delts', 'Triceps'] },
  { name: 'Half Kneeling Press',      muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Front Delts', 'Core', 'Triceps'] },
  { name: 'Machine Shoulder Press',   muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Front Delts', 'Triceps'] },
  { name: 'Overhead Press',           muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Front Delts', 'Triceps', 'Core'] },
  { name: 'Push Press',               muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Front Delts', 'Triceps', 'Legs'] },
  { name: 'Scott Press',              muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Front Delts', 'Triceps'] },
  { name: 'Seated Barbell Press',     muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Front Delts', 'Triceps'] },
  { name: 'Seated Dumbbell Press',    muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Front Delts', 'Triceps'] },
  { name: 'Smith Machine Shoulder Press', muscle: 'Shoulders', primary: 'Side Delts', secondary: ['Front Delts', 'Triceps'] },
  { name: 'Z-Press',                  muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Front Delts', 'Core', 'Triceps'] },
  // Lateral raises
  { name: 'Cable Lateral Raise',      muscle: 'Shoulders', primary: 'Side Delts',  secondary: [] },
  { name: 'Lateral Raise',            muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Traps'] },
  { name: 'Leaning Lateral Raise',    muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Traps'] },
  { name: 'Machine Lateral Raise',    muscle: 'Shoulders', primary: 'Side Delts',  secondary: [] },
  // Front raises
  { name: 'Cable Front Raise',        muscle: 'Shoulders', primary: 'Front Delts', secondary: ['Side Delts'] },
  { name: 'Front Raise',              muscle: 'Shoulders', primary: 'Front Delts', secondary: ['Side Delts', 'Traps'] },
  { name: 'Lu Raise',                 muscle: 'Shoulders', primary: 'Front Delts', secondary: ['Side Delts', 'Rear Delts'] },
  { name: 'Plate Front Raise',        muscle: 'Shoulders', primary: 'Front Delts', secondary: ['Traps'] },
  // Rear delt
  { name: 'Bent Over Lateral Raise',  muscle: 'Shoulders', primary: 'Rear Delts',  secondary: ['Rhomboids', 'Traps'] },
  { name: 'Cable Rear Delt Fly',      muscle: 'Shoulders', primary: 'Rear Delts',  secondary: ['Rhomboids'] },
  { name: 'Cable Y Raise',            muscle: 'Shoulders', primary: 'Rear Delts',  secondary: ['Rhomboids', 'Traps'] },
  { name: 'Machine Rear Delt Fly',    muscle: 'Shoulders', primary: 'Rear Delts',  secondary: ['Rhomboids'] },
  { name: 'Rear Delt Fly',            muscle: 'Shoulders', primary: 'Rear Delts',  secondary: ['Rhomboids', 'Traps'] },
  { name: 'Y-T-W Raises',             muscle: 'Shoulders', primary: 'Rear Delts',  secondary: ['Rhomboids', 'Traps'] },
  // Other
  { name: 'Band Pull Apart',          muscle: 'Shoulders', primary: 'Rear Delts',  secondary: ['Rhomboids'] },
  { name: 'Cable Upright Row',        muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Traps', 'Biceps'] },
  { name: 'Cuban Press',              muscle: 'Shoulders', primary: 'Rear Delts',  secondary: ['Rotator Cuff', 'Side Delts'] },
  { name: 'Dumbbell Upright Row',     muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Traps', 'Biceps'] },
  { name: 'Landmine Lateral Raise',   muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Front Delts'] },
  { name: 'Upright Row',              muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Traps', 'Biceps'] },
  // Bodyweight
  { name: 'Handstand Push Up',        muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Triceps', 'Traps', 'Core'] },
  { name: 'Pike Push Up',             muscle: 'Shoulders', primary: 'Side Delts',  secondary: ['Triceps', 'Front Delts'] },

  // ── ARMS ──────────────────────────────────────────────────────────────────
  // Bicep — barbell
  { name: 'Barbell Curl',             muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis', 'Forearms'] },
  { name: 'EZ Bar Curl',              muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis', 'Forearms'] },
  { name: 'Reverse Curl',             muscle: 'Arms', primary: 'Brachioradialis', secondary: ['Biceps', 'Forearms'] },
  // Bicep — dumbbell
  { name: 'Bayesian Curl',            muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis'] },
  { name: 'Bicep Curl',               muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis', 'Forearms'] },
  { name: 'Concentration Curl',       muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis'] },
  { name: 'Cross Body Curl',          muscle: 'Arms', primary: 'Brachialis',  secondary: ['Biceps', 'Brachioradialis'] },
  { name: 'Drag Curl',                muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis'] },
  { name: 'Hammer Curl',              muscle: 'Arms', primary: 'Brachialis',  secondary: ['Biceps', 'Forearms'] },
  { name: 'Incline Dumbbell Curl',    muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis'] },
  { name: 'Pinwheel Curl',            muscle: 'Arms', primary: 'Brachioradialis', secondary: ['Biceps', 'Forearms'] },
  { name: 'Seated Incline Curl',      muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis'] },
  { name: 'Spider Curl',              muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis'] },
  { name: 'Zottman Curl',             muscle: 'Arms', primary: 'Brachialis',  secondary: ['Biceps', 'Brachioradialis', 'Forearms'] },
  // Bicep — cable
  { name: 'Cable Curl',               muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis', 'Forearms'] },
  { name: 'Cable Hammer Curl',        muscle: 'Arms', primary: 'Brachialis',  secondary: ['Biceps', 'Forearms'] },
  { name: 'High Cable Curl',          muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis'] },
  { name: 'Rope Curl',                muscle: 'Arms', primary: 'Brachialis',  secondary: ['Biceps', 'Forearms'] },
  // Bicep — machine
  { name: 'Machine Bicep Curl',       muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis'] },
  { name: 'Preacher Curl',            muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis'] },
  // Misc
  { name: '21s',                      muscle: 'Arms', primary: 'Biceps',      secondary: ['Brachialis', 'Forearms'] },
  { name: 'Wrist Curl',               muscle: 'Arms', primary: 'Forearms',    secondary: [] },
  { name: 'Reverse Wrist Curl',       muscle: 'Arms', primary: 'Forearms',    secondary: [] },
  // Tricep — barbell
  { name: 'French Press',             muscle: 'Arms', primary: 'Triceps',     secondary: [] },
  { name: 'JM Press',                 muscle: 'Arms', primary: 'Triceps',     secondary: ['Front Delts', 'Mid Chest'] },
  { name: 'Skull Crusher',            muscle: 'Arms', primary: 'Triceps',     secondary: [] },
  // Tricep — dumbbell
  { name: 'Dumbbell Overhead Extension', muscle: 'Arms', primary: 'Triceps',  secondary: [] },
  { name: 'Rolling Tricep Extension', muscle: 'Arms', primary: 'Triceps',     secondary: [] },
  { name: 'Single Arm Overhead Extension', muscle: 'Arms', primary: 'Triceps', secondary: [] },
  { name: 'Tate Press',               muscle: 'Arms', primary: 'Triceps',     secondary: [] },
  { name: 'Tricep Kickback',          muscle: 'Arms', primary: 'Triceps',     secondary: [] },
  // Tricep — cable
  { name: 'Cable Overhead Tricep Extension', muscle: 'Arms', primary: 'Triceps', secondary: [] },
  { name: 'Overhead Tricep Extension',muscle: 'Arms', primary: 'Triceps',     secondary: [] },
  { name: 'Rope Pushdown',            muscle: 'Arms', primary: 'Triceps',     secondary: [] },
  { name: 'Single Arm Tricep Pushdown', muscle: 'Arms', primary: 'Triceps',   secondary: [] },
  { name: 'Tricep Pushdown',          muscle: 'Arms', primary: 'Triceps',     secondary: [] },
  // Tricep — machine / bodyweight
  { name: 'Bench Dips',               muscle: 'Arms', primary: 'Triceps',     secondary: ['Front Delts', 'Mid Chest'] },
  { name: 'Machine Tricep Extension', muscle: 'Arms', primary: 'Triceps',     secondary: [] },
  { name: 'Tricep Dips',              muscle: 'Arms', primary: 'Triceps',     secondary: ['Lower Chest', 'Front Delts'] },
  { name: 'Weighted Tricep Dips',     muscle: 'Arms', primary: 'Triceps',     secondary: ['Lower Chest', 'Front Delts'] },

  // ── CORE ──────────────────────────────────────────────────────────────────
  // Plank variations
  { name: 'Copenhagen Plank',         muscle: 'Core', primary: 'Adductors',   secondary: ['Obliques', 'Core'] },
  { name: 'Hollow Body Hold',         muscle: 'Core', primary: 'Abs',         secondary: ['Hip Flexors'] },
  { name: 'Hollow Rock',              muscle: 'Core', primary: 'Abs',         secondary: ['Hip Flexors'] },
  { name: 'L-Sit',                    muscle: 'Core', primary: 'Abs',         secondary: ['Triceps', 'Hip Flexors'] },
  { name: 'Plank',                    muscle: 'Core', primary: 'Transverse Abs', secondary: ['Core', 'Glutes'] },
  { name: 'Plank Hip Dip',            muscle: 'Core', primary: 'Obliques',    secondary: ['Transverse Abs'] },
  { name: 'RKC Plank',                muscle: 'Core', primary: 'Transverse Abs', secondary: ['Glutes', 'Quads'] },
  { name: 'Side Plank',               muscle: 'Core', primary: 'Obliques',    secondary: ['Core', 'Glutes'] },
  // Crunch / sit-up
  { name: 'Bicycle Crunch',           muscle: 'Core', primary: 'Obliques',    secondary: ['Abs'] },
  { name: 'Cable Crunch',             muscle: 'Core', primary: 'Abs',         secondary: ['Hip Flexors'] },
  { name: 'Crunch',                   muscle: 'Core', primary: 'Abs',         secondary: [] },
  { name: 'GHD Sit Up',               muscle: 'Core', primary: 'Abs',         secondary: ['Hip Flexors', 'Quads'] },
  { name: 'Landmine Crunch',          muscle: 'Core', primary: 'Obliques',    secondary: ['Abs'] },
  { name: 'Oblique Crunch',           muscle: 'Core', primary: 'Obliques',    secondary: ['Abs'] },
  { name: 'Reverse Crunch',           muscle: 'Core', primary: 'Lower Abs',   secondary: ['Hip Flexors'] },
  { name: 'Seated Ab Machine',        muscle: 'Core', primary: 'Abs',         secondary: ['Obliques'] },
  { name: 'Sit Up',                   muscle: 'Core', primary: 'Abs',         secondary: ['Hip Flexors'] },
  { name: 'Stability Ball Crunch',    muscle: 'Core', primary: 'Abs',         secondary: ['Core'] },
  { name: 'Toe Touch',                muscle: 'Core', primary: 'Abs',         secondary: ['Obliques'] },
  // Leg raise
  { name: 'Dragon Flag',              muscle: 'Core', primary: 'Abs',         secondary: ['Lower Back', 'Hip Flexors'] },
  { name: 'Flutter Kicks',            muscle: 'Core', primary: 'Hip Flexors', secondary: ['Lower Abs'] },
  { name: 'Hanging Knee Raise',       muscle: 'Core', primary: 'Abs',         secondary: ['Hip Flexors'] },
  { name: 'Hanging Leg Raise',        muscle: 'Core', primary: 'Lower Abs',   secondary: ['Hip Flexors'] },
  { name: 'Leg Raise',                muscle: 'Core', primary: 'Lower Abs',   secondary: ['Hip Flexors'] },
  { name: 'Scissor Kicks',            muscle: 'Core', primary: 'Hip Flexors', secondary: ['Lower Abs'] },
  { name: 'Toes to Bar',              muscle: 'Core', primary: 'Lower Abs',   secondary: ['Hip Flexors', 'Lats'] },
  { name: 'V-Up',                     muscle: 'Core', primary: 'Abs',         secondary: ['Hip Flexors'] },
  // Rotation / anti-rotation
  { name: 'Landmine Rotation',        muscle: 'Core', primary: 'Obliques',    secondary: ['Core', 'Shoulders'] },
  { name: 'Pallof Press',             muscle: 'Core', primary: 'Transverse Abs', secondary: ['Obliques'] },
  { name: 'Russian Twist',            muscle: 'Core', primary: 'Obliques',    secondary: ['Abs', 'Hip Flexors'] },
  { name: 'Side Bend',                muscle: 'Core', primary: 'Obliques',    secondary: [] },
  { name: 'Windshield Wiper',         muscle: 'Core', primary: 'Obliques',    secondary: ['Hip Flexors', 'Abs'] },
  { name: 'Woodchop',                 muscle: 'Core', primary: 'Obliques',    secondary: ['Core', 'Shoulders'] },
  // Rollouts
  { name: 'Ab Wheel Rollout',         muscle: 'Core', primary: 'Abs',         secondary: ['Lats', 'Triceps'] },
  { name: 'Barbell Rollout',          muscle: 'Core', primary: 'Abs',         secondary: ['Lats', 'Triceps'] },
  { name: 'Stir the Pot',             muscle: 'Core', primary: 'Abs',         secondary: ['Core'] },
  { name: 'Swiss Ball Rollout',       muscle: 'Core', primary: 'Abs',         secondary: ['Core'] },
  { name: 'TRX Fallout',              muscle: 'Core', primary: 'Abs',         secondary: ['Lats', 'Triceps'] },
  // Functional
  { name: 'Bear Crawl',               muscle: 'Core', primary: 'Core',        secondary: ['Shoulders', 'Hip Flexors'] },
  { name: 'Dead Bug',                 muscle: 'Core', primary: 'Transverse Abs', secondary: ['Core'] },
  { name: 'Inchworm',                 muscle: 'Core', primary: 'Core',        secondary: ['Hamstrings', 'Shoulders'] },
  { name: 'Mountain Climber',         muscle: 'Core', primary: 'Core',        secondary: ['Hip Flexors', 'Shoulders'] },
  { name: 'Suitcase Carry',           muscle: 'Core', primary: 'Obliques',    secondary: ['Core', 'Traps'] },
  { name: "Waiter's Walk",            muscle: 'Core', primary: 'Core',        secondary: ['Shoulders', 'Obliques'] },

  // ── CARDIO / FULL BODY ────────────────────────────────────────────────────
  // Jumps / plyometrics
  { name: 'Box Jump',                 muscle: 'Cardio', primary: 'Quads',     secondary: ['Glutes', 'Calves', 'Core'] },
  { name: 'Broad Jump',               muscle: 'Cardio', primary: 'Quads',     secondary: ['Glutes', 'Calves'] },
  { name: 'Depth Jump',               muscle: 'Cardio', primary: 'Quads',     secondary: ['Calves', 'Glutes'] },
  { name: 'Jump Squat',               muscle: 'Cardio', primary: 'Quads',     secondary: ['Glutes', 'Calves'] },
  { name: 'Jumping Jacks',            muscle: 'Cardio', primary: 'Full Body', secondary: ['Calves', 'Shoulders'] },
  { name: 'Lateral Bound',            muscle: 'Cardio', primary: 'Glutes',    secondary: ['Quads', 'Calves'] },
  { name: 'Plyometric Push Up',       muscle: 'Cardio', primary: 'Mid Chest', secondary: ['Triceps', 'Core'] },
  { name: 'Skater Jump',              muscle: 'Cardio', primary: 'Glutes',    secondary: ['Quads', 'Calves'] },
  { name: 'Tuck Jump',                muscle: 'Cardio', primary: 'Quads',     secondary: ['Hip Flexors', 'Calves'] },
  // Running / sprinting
  { name: 'Band Sprint',              muscle: 'Cardio', primary: 'Quads',     secondary: ['Glutes', 'Hamstrings', 'Core'] },
  { name: 'High Knees',               muscle: 'Cardio', primary: 'Hip Flexors', secondary: ['Quads', 'Core'] },
  { name: 'Lateral Shuffle',          muscle: 'Cardio', primary: 'Abductors', secondary: ['Quads', 'Glutes'] },
  { name: 'Power Skip',               muscle: 'Cardio', primary: 'Glutes',    secondary: ['Calves', 'Hip Flexors'] },
  { name: 'Shuttle Run',              muscle: 'Cardio', primary: 'Quads',     secondary: ['Glutes', 'Calves'] },
  { name: 'Sprint',                   muscle: 'Cardio', primary: 'Hamstrings',secondary: ['Glutes', 'Quads', 'Calves'] },
  // Jump rope
  { name: 'Double Unders',            muscle: 'Cardio', primary: 'Calves',    secondary: ['Shoulders', 'Core'] },
  { name: 'Jump Rope',                muscle: 'Cardio', primary: 'Calves',    secondary: ['Shoulders', 'Core'] },
  // Full body
  { name: 'Burpees',                  muscle: 'Cardio', primary: 'Full Body', secondary: ['Chest', 'Quads', 'Core'] },
  { name: 'Jumping Lunge',            muscle: 'Cardio', primary: 'Quads',     secondary: ['Glutes', 'Calves'] },
  { name: 'Man Maker',                muscle: 'Cardio', primary: 'Full Body', secondary: ['Chest', 'Back', 'Legs'] },
  { name: 'Squat Thrust',             muscle: 'Cardio', primary: 'Quads',     secondary: ['Core', 'Chest'] },
  // Sleds / carries
  { name: "Farmer's Walk",            muscle: 'Cardio', primary: 'Traps',     secondary: ['Core', 'Forearms', 'Legs'] },
  { name: 'Sandbag Carry',            muscle: 'Cardio', primary: 'Core',      secondary: ['Traps', 'Legs'] },
  { name: 'Sled March',               muscle: 'Cardio', primary: 'Glutes',    secondary: ['Quads', 'Core'] },
  { name: 'Sled Pull',                muscle: 'Cardio', primary: 'Hamstrings',secondary: ['Glutes', 'Back'] },
  { name: 'Sled Push',                muscle: 'Cardio', primary: 'Quads',     secondary: ['Glutes', 'Core'] },
  // Battle ropes / bags
  { name: 'Battle Ropes',             muscle: 'Cardio', primary: 'Shoulders', secondary: ['Core', 'Back'] },
  { name: 'Medicine Ball Slam',       muscle: 'Cardio', primary: 'Full Body', secondary: ['Core', 'Lats'] },
  { name: 'Rotational Medicine Ball Throw', muscle: 'Cardio', primary: 'Obliques', secondary: ['Core', 'Shoulders'] },
  { name: 'Tire Flip',                muscle: 'Cardio', primary: 'Full Body', secondary: ['Glutes', 'Back', 'Legs'] },
  { name: 'Wall Ball',                muscle: 'Cardio', primary: 'Quads',     secondary: ['Shoulders', 'Core'] },
  // Kettlebell
  { name: 'Kettlebell Clean',         muscle: 'Cardio', primary: 'Full Body', secondary: ['Glutes', 'Back', 'Shoulders'] },
  { name: 'Kettlebell Snatch',        muscle: 'Cardio', primary: 'Full Body', secondary: ['Glutes', 'Shoulders', 'Core'] },
  { name: 'Kettlebell Swing',         muscle: 'Cardio', primary: 'Glutes',    secondary: ['Hamstrings', 'Core', 'Back'] },
  { name: 'Turkish Get Up',           muscle: 'Cardio', primary: 'Full Body', secondary: ['Shoulders', 'Core', 'Legs'] },
  // Olympic / barbell
  { name: 'Clean and Jerk',           muscle: 'Cardio', primary: 'Full Body', secondary: ['Legs', 'Back', 'Shoulders'] },
  { name: 'Dumbbell Thruster',        muscle: 'Cardio', primary: 'Full Body', secondary: ['Quads', 'Shoulders', 'Core'] },
  { name: 'Hang Clean',               muscle: 'Cardio', primary: 'Traps',     secondary: ['Glutes', 'Hamstrings', 'Back'] },
  { name: 'Power Clean',              muscle: 'Cardio', primary: 'Glutes',    secondary: ['Hamstrings', 'Traps', 'Back'] },
  { name: 'Thruster',                 muscle: 'Cardio', primary: 'Full Body', secondary: ['Quads', 'Shoulders', 'Core'] },
  // Agility
  { name: 'Agility Ladder',           muscle: 'Cardio', primary: 'Full Body', secondary: ['Calves', 'Hip Flexors'] },
  { name: 'Cone Drill',               muscle: 'Cardio', primary: 'Quads',     secondary: ['Glutes', 'Calves', 'Core'] },
  { name: 'Explosive Step Up',        muscle: 'Cardio', primary: 'Quads',     secondary: ['Glutes', 'Calves'] },
  // Combat
  { name: 'Shadow Boxing',            muscle: 'Cardio', primary: 'Shoulders', secondary: ['Core', 'Legs'] },
  // Machines / steady state
  { name: 'Assault Bike',             muscle: 'Cardio', primary: 'Full Body', secondary: ['Quads', 'Shoulders'] },
  { name: 'Elliptical',               muscle: 'Cardio', primary: 'Quads',     secondary: ['Glutes', 'Hamstrings'] },
  { name: 'Rowing Machine',           muscle: 'Cardio', primary: 'Back',      secondary: ['Legs', 'Core', 'Biceps'] },
  { name: 'Stair Climber',            muscle: 'Cardio', primary: 'Glutes',    secondary: ['Quads', 'Calves'] },
  { name: 'Stationary Bike',          muscle: 'Cardio', primary: 'Quads',     secondary: ['Glutes', 'Calves'] },
  { name: 'Swimming',                 muscle: 'Cardio', primary: 'Full Body', secondary: ['Back', 'Shoulders', 'Core'] },
  { name: 'Treadmill Run',            muscle: 'Cardio', primary: 'Quads',     secondary: ['Hamstrings', 'Glutes', 'Calves'] },
  { name: 'Versa Climber',            muscle: 'Cardio', primary: 'Full Body', secondary: ['Shoulders', 'Legs', 'Core'] },
  { name: 'Walking',                  muscle: 'Cardio', primary: 'Quads',     secondary: ['Glutes', 'Calves'] },
];
