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
  // Chest
  { name: 'Bench Press', muscle: 'Chest' },
  { name: 'Incline Bench Press', muscle: 'Chest' },
  { name: 'Decline Bench Press', muscle: 'Chest' },
  { name: 'Dumbbell Chest Press', muscle: 'Chest' },
  { name: 'Incline Dumbbell Press', muscle: 'Chest' },
  { name: 'Chest Fly', muscle: 'Chest' },
  { name: 'Incline Chest Fly', muscle: 'Chest' },
  { name: 'Cable Crossover', muscle: 'Chest' },
  { name: 'Pec Deck', muscle: 'Chest' },
  { name: 'Push Up', muscle: 'Chest' },
  { name: 'Wide Push Up', muscle: 'Chest' },
  { name: 'Decline Push Up', muscle: 'Chest' },
  { name: 'Dips', muscle: 'Chest' },

  // Back
  { name: 'Pull Up', muscle: 'Back' },
  { name: 'Chin Up', muscle: 'Back' },
  { name: 'Lat Pulldown', muscle: 'Back' },
  { name: 'Seated Cable Row', muscle: 'Back' },
  { name: 'Bent Over Barbell Row', muscle: 'Back' },
  { name: 'Single Arm Dumbbell Row', muscle: 'Back' },
  { name: 'T-Bar Row', muscle: 'Back' },
  { name: 'Deadlift', muscle: 'Back' },
  { name: 'Sumo Deadlift', muscle: 'Back' },
  { name: 'Romanian Deadlift', muscle: 'Back' },
  { name: 'Face Pull', muscle: 'Back' },
  { name: 'Barbell Shrug', muscle: 'Back' },
  { name: 'Hyperextension', muscle: 'Back' },
  { name: 'Good Morning', muscle: 'Back' },

  // Legs
  { name: 'Squat', muscle: 'Legs' },
  { name: 'Front Squat', muscle: 'Legs' },
  { name: 'Sumo Squat', muscle: 'Legs' },
  { name: 'Goblet Squat', muscle: 'Legs' },
  { name: 'Bulgarian Split Squat', muscle: 'Legs' },
  { name: 'Leg Press', muscle: 'Legs' },
  { name: 'Lunges', muscle: 'Legs' },
  { name: 'Walking Lunges', muscle: 'Legs' },
  { name: 'Reverse Lunge', muscle: 'Legs' },
  { name: 'Leg Curl', muscle: 'Legs' },
  { name: 'Leg Extension', muscle: 'Legs' },
  { name: 'Hip Thrust', muscle: 'Legs' },
  { name: 'Glute Bridge', muscle: 'Legs' },
  { name: 'Step Up', muscle: 'Legs' },
  { name: 'Calf Raise', muscle: 'Legs' },
  { name: 'Seated Calf Raise', muscle: 'Legs' },
  { name: 'Hack Squat', muscle: 'Legs' },

  // Shoulders
  { name: 'Overhead Press', muscle: 'Shoulders' },
  { name: 'Dumbbell Shoulder Press', muscle: 'Shoulders' },
  { name: 'Arnold Press', muscle: 'Shoulders' },
  { name: 'Lateral Raise', muscle: 'Shoulders' },
  { name: 'Cable Lateral Raise', muscle: 'Shoulders' },
  { name: 'Front Raise', muscle: 'Shoulders' },
  { name: 'Rear Delt Fly', muscle: 'Shoulders' },
  { name: 'Upright Row', muscle: 'Shoulders' },
  { name: 'Pike Push Up', muscle: 'Shoulders' },

  // Arms
  { name: 'Bicep Curl', muscle: 'Arms' },
  { name: 'Barbell Curl', muscle: 'Arms' },
  { name: 'Hammer Curl', muscle: 'Arms' },
  { name: 'Concentration Curl', muscle: 'Arms' },
  { name: 'Preacher Curl', muscle: 'Arms' },
  { name: 'Cable Curl', muscle: 'Arms' },
  { name: 'Incline Dumbbell Curl', muscle: 'Arms' },
  { name: 'Tricep Pushdown', muscle: 'Arms' },
  { name: 'Skull Crusher', muscle: 'Arms' },
  { name: 'Close Grip Bench Press', muscle: 'Arms' },
  { name: 'Overhead Tricep Extension', muscle: 'Arms' },
  { name: 'Tricep Kickback', muscle: 'Arms' },
  { name: 'Diamond Push Up', muscle: 'Arms' },

  // Core
  { name: 'Plank', muscle: 'Core' },
  { name: 'Side Plank', muscle: 'Core' },
  { name: 'Crunch', muscle: 'Core' },
  { name: 'Sit Up', muscle: 'Core' },
  { name: 'Leg Raise', muscle: 'Core' },
  { name: 'Hanging Leg Raise', muscle: 'Core' },
  { name: 'Russian Twist', muscle: 'Core' },
  { name: 'Mountain Climber', muscle: 'Core' },
  { name: 'Dead Bug', muscle: 'Core' },
  { name: 'Cable Crunch', muscle: 'Core' },
  { name: 'Ab Wheel Rollout', muscle: 'Core' },
  { name: 'Bicycle Crunch', muscle: 'Core' },
  { name: 'Flutter Kicks', muscle: 'Core' },
  { name: 'V-Up', muscle: 'Core' },

  // Cardio / Full Body
  { name: 'Burpees', muscle: 'Cardio' },
  { name: 'Jumping Jacks', muscle: 'Cardio' },
  { name: 'Jump Rope', muscle: 'Cardio' },
  { name: 'Box Jump', muscle: 'Cardio' },
  { name: 'Battle Ropes', muscle: 'Cardio' },
  { name: 'Sled Push', muscle: 'Cardio' },
  { name: 'Farmer\'s Walk', muscle: 'Cardio' },
  { name: 'Kettlebell Swing', muscle: 'Cardio' },
  { name: 'High Knees', muscle: 'Cardio' },
  { name: 'Jump Squat', muscle: 'Cardio' },
  { name: 'Treadmill Run', muscle: 'Cardio' },
  { name: 'Rowing Machine', muscle: 'Cardio' },
  { name: 'Assault Bike', muscle: 'Cardio' },
];
