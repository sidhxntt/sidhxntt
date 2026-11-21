import * as THREE from 'three/webgpu'
import { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import nameFont from '../../../data/nameFont.js'
import { NAME, MONOGRAM } from '../../../data/name.js'
import socialData from '../../../data/social.js'

// Builds the owner's text into the world as physical 3D letters (Montserrat
// ExtraBold, see scripts/build-name-font.mjs), replacing objects baked into
// the area models before the areas turn their children into physics objects:
//  - the big name letters on the landing area
//  - the logos on the social area's pads that have no matching link
//  - the statue (and its companions) on the social area's pedestal

let font = null
const getFont = () => font ?? (font = new Font(nameFont))

/** One palette texel colours a whole object; read it from a baked mesh. */
function paletteUv(object)
{
    let mesh = object.isMesh ? object : null
    object.traverse((child) => { if(!mesh && child.isMesh) mesh = child })
    const uv = mesh?.geometry.attributes.uv
    return { mesh, u: uv ? uv.getX(0) : 0, v: uv ? uv.getY(0) : 0 }
}

/**
 * A physical 3D text object, centred on its origin with its bottom at
 * -height / 2, and a box collider; name it so Objects.getFromModel makes it
 * a dynamic body.
 */
function buildText(text, { height, depth, material, u, v, name, userData })
{
    const capGeometry = new TextGeometry('H', { font: getFont(), size: 1, depth, curveSegments: 3, bevelEnabled: false })
    capGeometry.computeBoundingBox()
    const size = height / (capGeometry.boundingBox.max.y - capGeometry.boundingBox.min.y)
    capGeometry.dispose()

    const geometry = new TextGeometry(text, { font: getFont(), size, depth, curveSegments: 3, bevelEnabled: false })
    geometry.computeBoundingBox()
    const box = geometry.boundingBox
    const width = box.max.x - box.min.x
    geometry.translate(-(box.min.x + width / 2), -height / 2, -depth / 2)

    const uv = new Float32Array(geometry.attributes.position.count * 2)
    for(let i = 0; i < uv.length; i += 2)
    {
        uv[i] = u
        uv[i + 1] = v
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    geometry.computeVertexNormals()

    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.userData = { ...userData }

    const collider = new THREE.Object3D()
    collider.name = `cuboid${name}`
    collider.scale.set(width, height, depth)
    mesh.add(collider)

    return { mesh, width }
}

/* ── Landing: the name ─────────────────────────────────────────────────── */

const LETTER_PATTERN = /^refLettersPhysicalDynamic/i
const NAME_SIZE = 0.85 // a little smaller than the original letters, the name is longer
const LETTER_GAP = 0.16
const WORD_GAP = 0.55

export function replaceNameLetters(model)
{
    const originals = model.children.filter((child) => LETTER_PATTERN.test(child.name))
    if(originals.length === 0)
        return model

    const template = originals[0]
    const templateCollider = template.children.find((child) => /^cuboid/i.test(child.name))
    const originalHeight = templateCollider ? templateCollider.scale.y : 1.45
    const height = originalHeight * NAME_SIZE
    const depth = templateCollider ? templateCollider.scale.z : 0.44
    const { u, v } = paletteUv(template)

    // the row runs along the letters' local x axis, centred where the old name was
    const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(template.quaternion)
    const centre = new THREE.Vector3()
    for(const letter of originals)
        centre.add(letter.position)
    centre.divideScalar(originals.length)

    const items = [...NAME].map((char, i) => char === ' '
        ? { space: true }
        : buildText(char, {
            height,
            depth,
            material: template.material,
            u,
            v,
            name: `refLettersPhysicalDynamic${100 + i}`,
            userData: template.userData,
        }))

    const gap = LETTER_GAP * NAME_SIZE
    const wordGap = WORD_GAP * NAME_SIZE
    const advance = (item, next) => (item.space ? wordGap : item.width) + (!item.space && next && !next.space ? gap : 0)
    const total = items.reduce((sum, item, i) => sum + advance(item, items[i + 1]), 0)

    for(const letter of originals)
        letter.removeFromParent()

    let cursor = -total / 2
    items.forEach((item, i) =>
    {
        if(!item.space)
        {
            item.mesh.quaternion.copy(template.quaternion)
            item.mesh.position.copy(centre).addScaledVector(direction, cursor + item.width / 2)
            item.mesh.position.y = template.position.y + (height - originalHeight) / 2 // same ground line
            model.add(item.mesh)
        }
        cursor += advance(item, items[i + 1])
    })

    return model
}

/* ── Social: pads and pedestal ─────────────────────────────────────────── */

// The baked logo on each pad, in pad order (matches data/social.js order)
const PAD_LOGOS = [ /^x/i, /^bluesky/i, /^youtube/i, /^mail/i, /^twitch/i, /^gitHub/i, /^linkedIn/i, /^discord/i ]
const ICON_HEIGHT = 1.3
const ICON_DEPTH = 0.3
// The statue's companions on the pedestal, removed with it
const PEDESTAL_EXTRAS = [ /^boy/i, /^sudo/i, /^baguira/i ]
const MONOGRAM_HEIGHT = 3.2

export function customizeSocial(model)
{
    // Pads: swap the logo for letters where the link has an icon
    socialData.forEach((link, i) =>
    {
        const pattern = PAD_LOGOS[i]
        if(!pattern || !link.icon)
            return
        const logo = model.children.find((child) => pattern.test(child.name) && /physical/i.test(child.name))
        if(!logo)
            return

        const { mesh: logoMesh, u, v } = paletteUv(logo)
        const { mesh } = buildText(link.icon, {
            height: ICON_HEIGHT,
            depth: ICON_DEPTH,
            material: logoMesh.material,
            u,
            v,
            name: `socialIcon${i}PhysicalDynamic`,
            userData: logo.userData,
        })
        // stand on the pad, facing the same way as the logo it replaces
        mesh.position.copy(logo.position)
        mesh.position.y = logo.position.y - 0.1
        logo.removeFromParent()
        model.add(mesh)
    })

    // Pedestal: the monogram in place of the statue and its companions
    for(const child of [...model.children])
        if(PEDESTAL_EXTRAS.some((pattern) => pattern.test(child.name)))
            child.removeFromParent()

    const statue = model.children.find((child) => /^refStatue/i.test(child.name))
    if(statue)
    {
        const { mesh: statueMesh, u, v } = paletteUv(statue)
        statueMesh.geometry.computeBoundingBox()
        const bottom = statueMesh.geometry.boundingBox.min.y
        const { mesh } = buildText(MONOGRAM, {
            height: MONOGRAM_HEIGHT,
            depth: 0.6,
            material: statueMesh.material,
            u,
            v,
            name: statue.name, // keeps the 'statue' reference the area uses
            userData: statue.userData,
        })
        mesh.position.copy(statue.position)
        mesh.position.y = statue.position.y + bottom + MONOGRAM_HEIGHT / 2
        mesh.quaternion.copy(statue.quaternion)
        statue.removeFromParent()
        model.add(mesh)
    }

    return model
}
