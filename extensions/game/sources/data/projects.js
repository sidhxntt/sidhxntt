// The big screens in the projects area. Mirrors the portfolio's own data
// (src/data/portfolio.ts in the main site). Images live in
// static/projects/images: 960×540, .png or .ktx.
//
// attributes.role / attributes.with show under the title; distinctions takes
// any of 'awwwards', 'fwa', 'cssda' (none here).

export default [
    {
        title: 'Rudder',
        titleSmall: [ 'Rudder' ],
        url: 'https://github.com/sidhxntt/rudder',
        attributes:
        {
            role: 'Creator',
            with: [ 'FastAPI', 'Kubernetes' ]
        },
        distinctions: [],
        images:
        [
            'rudder-1.png',
            'rudder-2.png',
            'rudder-3.png',
            'rudder-4.png',
            'rudder-5.png',
            'rudder-6.png',
        ]
    },
    {
        title: 'Praxis',
        titleSmall: [ 'Praxis' ],
        url: 'https://praxis-alpha.vercel.app/',
        attributes:
        {
            role: 'Creator',
            with: [ 'Node.js', 'Next.js' ]
        },
        distinctions: [],
        images:
        [
            'praxis-1.png',
        ]
    },
    {
        title: 'Praxis Pro',
        titleSmall: [ 'Praxis', 'Pro' ],
        url: 'https://praxis-alpha.vercel.app/pro',
        attributes:
        {
            role: 'Creator',
            with: [ 'Django', 'PostgreSQL' ]
        },
        distinctions: [],
        images:
        [
            'praxis-pro-1.png',
        ]
    },
    {
        title: 'DevXp',
        titleSmall: [ 'DevXp' ],
        url: 'https://devxp.in',
        attributes:
        {
            role: 'Creator',
            with: [ 'React', 'Contentful' ]
        },
        distinctions: [],
        images:
        [
            'devxp-1.png',
        ]
    },
]
