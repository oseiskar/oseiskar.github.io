import Head from 'next/head'
import GithubProject from './github-project.js'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 bg-gray-300">
      <Head>
        <title>oseiskar.github.io</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 pt-10 pb-20">
        <h1 className="mt-3 text-2xl">
          Selected open source projects by <a href='https://github.com/oseiskar' className="text-blue-700 hover:text-blue-300">oseiskar</a>
        </h1>

        <div className="flex flex-wrap items-center justify-around max-w-7xl mt-6 sm:w-full">
          <GithubProject
            name="Black Hole"
            repo="black-hole"
            image="img/black-hole.jpg"
            url="https://oseiskar.github.io/black-hole"
            description="
              A real time ray-traced simulation of a Schwarzschild black hole using THREE.js.
              The contributions of various special and general relativistic effects can be toggled from the GUI.
              Needs a decent GPU and a recent variant of Chrome or Firefox to run smoothly."/>
          <GithubProject
            name="WebGL Raytracer"
            repo="webgl-raytracer"
            image="img/webgl-raytracer.png"
            url="https://oseiskar.github.io/webgl-raytracer"
            description="
              Run a GPU-powered bidirectional raytracer in the browser and experiment with different
              scenes and rendering options. Should work on Firefox and Chrome. GPGPU now possible
              without spending hours installing CUDA!"/>
          <GithubProject
            name="Tree of Life"
            repo="tree-of-life"
            image="img/tree-of-life.png"
            url="https://oseiskar.github.io/tree-of-life"
            description="
              An interactive visualization of the Open Tree of Life using d3.js.
              The entire tree with approximately 2.3 million identified species as
              leaf nodes is browsable through the application. The width of the
              branches in the visualization represents the number of species
              they contain"/>
          <GithubProject
            name="Corona Sniffer"
            repo="corona-sniffer"
            image="https://repository-images.githubusercontent.com/259749452/1f154800-8eb3-11ea-8824-2a31bc68aa84"
            url="https://github.com/oseiskar/corona-sniffer"
            description="
              How anonymous is the Apple/Google BLE contract tracing system (GAEN/ENS)? A proof-of-concept BLE sniffing attack against the system."/>
          <GithubProject
            name="AR-3dtris"
            repo="3dtris"
            image="img/3dtris.jpg"
            url="https://play.google.com/store/apps/details?id=xyz.osei.tris"
            description="
              Sort out a frustrating mess of falling 3D blocks in
              Augmented Reality on Anrdoid or the browser. A game and an experiment
              using WebGL, Emscripten and ARCore."/>
          <GithubProject
            name="SIMD Kalman"
            repo="simdkalman"
            image="img/simdkalman.png"
            url="https://simdkalman.readthedocs.io/en/latest/"
            description="
              Fast Kalman filters in Python leveraging single-instruction multiple-data vectorization.
              That is, running n similar Kalman filters on n independent series of observations."/>
          <GithubProject
            name="Mersenne Twister"
            repo="mersenne-twister"
            image="img/mersenne-twister.png"
            url="https://oseiskar.github.io/mersenne-twister"
            description="
              Can you spot the difference between the C random number generator
              and Mersenne Twister?"/>
          <GithubProject
            name="Baro floor height"
            repo="BaroFloorHeight"
            image="img/baro-floor-height.png"
            url="https://play.google.com/store/apps/details?id=xyz.osei.baro&hl=en"
            description="
              An Andoid app for measuring the height of storeys and buildings using the barometer."/>
        </div>
      </main>
    </div>
  )
}
