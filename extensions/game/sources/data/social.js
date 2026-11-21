// The social area: a half circle of 8 pads around a pedestal, one link per
// pad, in order from the right-hand end (the X logo) round to the left.
//
// Four pads carry a matching 3D logo that is part of the world model; `keep`
// leaves it there. On the others, `icon` replaces the logo with 3D letters.
// Exactly 8 entries. `align` puts the label left or right of its pad.
export default [
    { name: 'X', url: 'https://x.com/sidhxntt', align: 'right', keep: true },
    { name: 'Peerlist', url: 'https://peerlist.io/sidhxntt', align: 'right', icon: 'P' },
    { name: 'Medium', url: 'https://medium.com/@sidhxntt', align: 'right', icon: 'M' },
    { name: 'Mail', url: 'mailto:siddhantg2002@gmail.com', align: 'right', keep: true },
    { name: 'Product Hunt', url: 'https://www.producthunt.com/@sidhxntt', align: 'right', icon: 'PH' },
    { name: 'GitHub', url: 'https://github.com/sidhxntt', align: 'right', keep: true },
    { name: 'LinkedIn', url: 'https://www.linkedin.com/in/sidhxntt', align: 'left', keep: true },
    { name: 'Book a call', url: 'https://cal.com/sidhxntt', align: 'left', icon: 'Hi' },
]
