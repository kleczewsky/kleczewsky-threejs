import { VertexShader, FragmentShader } from './bloom_shaders'

import * as THREE from 'three'

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { SSRPass } from 'three/examples/jsm/postprocessing/SSRPass.js'
import { ReflectorForSSRPass } from 'three/examples/jsm/objects/ReflectorForSSRPass.js'

export default class PostProcessing {
  constructor(context) {
    this.context = context
    this._Initalize()
  }

  _Initalize() {
    this.context.letterData = {}
    this.context.bloomLayer = new THREE.Layers()
    this.context.bloomLayer.set(1)
    this.context.letterData.materials = {}

    const renderPass = new RenderPass(this.context.scene, this.context.camera)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight)
    )

    bloomPass.threshold = 0
    bloomPass.strength = 0.9
    bloomPass.radius = 0.15
    this.context.effectComposers.bloomComposer = new EffectComposer(
      this.context.renderer
    )
    this.context.effectComposers.bloomComposer.renderToScreen = false
    this.context.effectComposers.bloomComposer.addPass(renderPass)
    this.context.effectComposers.bloomComposer.addPass(bloomPass)

    const shaderPass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: {
            value: this.context.effectComposers.bloomComposer.renderTarget2
              .texture,
          },
        },
        vertexShader: VertexShader,
        fragmentShader: FragmentShader,
        defines: {},
      }),
      'baseTexture'
    )
    shaderPass.needsSwap = true

    this.context.effectComposers.finalComposer = new EffectComposer(
      this.context.renderer
    )

    const loader = new THREE.CubeTextureLoader()
    loader.setPath('./src/models/textures/cubemap/')
    // todo: optimize skybox size
    this.backgroundTexture = loader.load([
      'corona_ft.png',
      'corona_bk.png',
      'corona_up.png',
      'corona_dn.png',
      'corona_rt.png',
      'corona_lf.png',
    ])

    const geometry = new THREE.PlaneBufferGeometry(1, 1)
    const groundReflector = new ReflectorForSSRPass(geometry, {
      clipBias: 0.0003,
      textureWidth: window.innerWidth,
      textureHeight: window.innerHeight,
      color: 0x888888,
      useDepthTexture: true,
    })
    groundReflector.material.depthWrite = false
    groundReflector.rotation.x = -Math.PI / 2
    groundReflector.visible = false
    this.context.scene.add(groundReflector)

    const ssrPass = new SSRPass({
      renderer: this.context.renderer,
      scene: this.context.scene,
      camera: this.context.camera,
      width: window.innerWidth,
      height: window.innerHeight,
      groundReflector: groundReflector,
    })

    ssrPass.maxDistance = 3

    this.context.effectComposers.finalComposer.addPass(renderPass)
    this.context.effectComposers.finalComposer.addPass(ssrPass)
    this.context.effectComposers.finalComposer.addPass(shaderPass)
  }

  render() {
    this.context.scene.background = new THREE.Color(0x000000)
    this.context.scene.traverse((obj) => {
      if (obj.isMesh && this.context.bloomLayer.test(obj.layers) === false) {
        this.context.letterData.materials[obj.uuid] = obj.material
        obj.material = this.context.DARK_MATERIAL
      }
    })
    this.context.effectComposers.bloomComposer.render()

    this.context.scene.background = this.backgroundTexture
    this.context.scene.traverse((obj) => {
      if (this.context.letterData.materials[obj.uuid]) {
        obj.material = this.context.letterData.materials[obj.uuid]
        delete this.context.letterData.materials[obj.uuid]
      }
    })
    this.context.effectComposers.finalComposer.render()
  }
}