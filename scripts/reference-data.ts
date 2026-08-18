/**
 * Category and tech-stack vocabularies. Kept in their own module so scripts can
 * import them without executing a seeding routine as a side effect.
 */

export const CATEGORIES = [
  // No App Store genre: AI cuts across Apple's taxonomy rather than sitting in
  // it. A genre here would shadow the category that genuinely owns it.
  ['ai', 'AI', 'Assistants, generation, and on-device models', null],
  ['productivity', 'Productivity', 'Notes, tasks, focus, and automation', 'Productivity'],
  ['health-fitness', 'Health & Fitness', 'Training, tracking, and recovery', 'Health & Fitness'],
  ['finance', 'Finance', 'Budgeting, investing, and banking', 'Finance'],
  ['photo-video', 'Photo & Video', 'Editing, capture, and effects', 'Photo & Video'],
  [
    'developer-tools',
    'Developer Tools',
    'Building, testing, and shipping software',
    'Developer Tools',
  ],
  ['education', 'Education', 'Learning, languages, and study tools', 'Education'],
  ['utilities', 'Utilities', 'Small tools that do one thing well', 'Utilities'],
  ['social', 'Social', 'Messaging, communities, and sharing', 'Social Networking'],
  ['games', 'Games', 'Premium and free-to-play titles', 'Games'],
  ['entertainment', 'Entertainment', 'Streaming, fandom, and things to watch', 'Entertainment'],
  ['lifestyle', 'Lifestyle', 'Habits, home, dating, and daily life', 'Lifestyle'],
  ['travel', 'Travel', 'Trips, maps, and getting there', 'Travel'],
  ['music', 'Music', 'Listening, making, and practising', 'Music'],
  ['business', 'Business', 'Running a company and getting work done', 'Business'],
  ['shopping', 'Shopping', 'Buying, comparing, and tracking orders', 'Shopping'],
  ['food-drink', 'Food & Drink', 'Cooking, ordering, and finding a table', 'Food & Drink'],
  ['news', 'News', 'Headlines, feeds, and following a story', 'News'],
  ['sports', 'Sports', 'Scores, teams, and training', 'Sports'],
  ['navigation', 'Navigation', 'Maps, routing, and getting around', 'Navigation'],
  ['weather', 'Weather', 'Forecasts, radar, and conditions', 'Weather'],
  ['books', 'Books', 'Reading, listening, and libraries', 'Books'],
  ['reference', 'Reference', 'Dictionaries, manuals, and lookup', 'Reference'],
  ['medical', 'Medical', 'Clinical tools and patient care', 'Medical'],
  [
    'graphics-design',
    'Graphics & Design',
    'Drawing, modelling, and visual work',
    'Graphics & Design',
  ],
  [
    'magazines-newspapers',
    'Magazines & Newspapers',
    'Issues, subscriptions, and long reads',
    'Magazines & Newspapers',
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
