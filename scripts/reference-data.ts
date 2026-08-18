/**
 * Category and tech-stack vocabularies. Kept in their own module so scripts can
 * import them without executing a seeding routine as a side effect.
 */

export const CATEGORIES = [
  // No App Store genre: AI cuts across Apple's taxonomy rather than sitting in
  // it. A genre here would shadow the category that genuinely owns it.
  ['ai', 'AI', 'Assistants, generation, and on-device models', null],
  ['health-fitness', 'Health & Fitness', 'Training, tracking, and recovery', 'Health & Fitness'],
  ['productivity', 'Productivity', 'Notes, tasks, focus, and automation', 'Productivity'],
  ['finance', 'Finance', 'Budgeting, investing, and banking', 'Finance'],
  ['photo-video', 'Photo & Video', 'Editing, capture, and effects', 'Photo & Video'],
  ['education', 'Education', 'Learning, languages, and study tools', 'Education'],
  ['utilities', 'Utilities', 'Small tools that do one thing well', 'Utilities'],
  ['social', 'Social', 'Messaging, communities, and sharing', 'Social Networking'],
  ['games', 'Games', 'Premium and free-to-play titles', 'Games'],
  [
    'developer-tools',
    'Developer Tools',
    'Building, testing, and shipping software',
    'Developer Tools',
  ],
] as const

export const TECH_TAGS = [
  ['swiftui', 'SwiftUI', 'framework'],
  ['uikit', 'UIKit', 'framework'],
  ['react-native', 'React Native', 'framework'],
  ['flutter', 'Flutter', 'framework'],
  ['expo', 'Expo', 'framework'],
  ['swift', 'Swift', 'language'],
  ['supabase', 'Supabase', 'backend'],
  ['firebase', 'Firebase', 'backend'],
  ['cloudkit', 'CloudKit', 'backend'],
  ['revenuecat', 'RevenueCat', 'monetization'],
  ['superwall', 'Superwall', 'monetization'],
  ['storekit-2', 'StoreKit 2', 'monetization'],
] as const
