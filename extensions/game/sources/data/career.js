// The career timeline. The stones, their slots and rails are built into the
// area model; each job reuses one of them (`slot`, named after the label it
// originally carried). Slots not listed here are hidden, rails included.
//
// The path is 17 world units long. `yearAtStart` is the year where it begins
// and `unitsPerYear` how far one year stretches, chosen so the reused slots
// start on the jobs' real dates:
//   careerImmersiveGarden starts 8.01 units in  → Sep 2023
//   careerOnlineTeacher   starts 10.99 units in → Oct 2024
//   → 2.98 units / 1.083 years = 2.75 units per year, path from late 2020 to late 2026
//
// Labels live in static/career as .png at the slot's original label size
// (340×60 and 332×92): red text on a green box per line.

export default {
    yearAtStart: 2020.755,
    unitsPerYear: 2.751,
    jobs:
    [
        {
            // Data Analyst Intern, Mondelez International, Sep 2023 – Apr 2024
            slot: 'careerImmersiveGarden',
            label: 'careerMondelez',
            color: 'orange',
        },
        {
            // Data Engineer, Tredence Inc., Oct 2024 – present
            slot: 'careerOnlineTeacher',
            label: 'careerTredence',
            color: 'purple',
        },
    ]
}
