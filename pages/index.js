import Head from 'next/head';
import { GithubProject, ShortGithubProject } from './github-project.js';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLinkedin, faGithub, faInstagram, faXTwitter, faKaggle, faStackOverflow, faMedium, faGoogleScholar, faBluesky } from '@fortawesome/free-brands-svg-icons';

export default function Home() {
  return (
    <main className="mx-auto max-w-screen-xl flex pt-4 flex-col lg:flex-row min-h-screen divide-x divide-gray-600 divide-dotted">
      <Head>
        <title>Otto Seiskari - personal web page</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* 
        Left Column
      */}
      <aside className="flex flex-col mb-10 px-6 lg:pr-0">
        <div className="inline-flex flex-col items-center lg:ml-auto lg:pr-12 lg:w-72">
          <img
            src="img/otto.jpg"
            alt="Person"
            className="rounded-full object-cover shadow-lg w-72"
          />
          <span className="text-3xl mt-8">Otto Seiskari</span>
          <span className="my-6 aside-small-texts text-center">Programmer, math PhD (D.Sc.), startup CEO @ <a href="https://www.spectacularai.com/">Spectacular AI</a></span>

          <div className="flex flex-row flex-wrap lg:flex-col gap-4 max-w-80 justify-center my-2 menu-links">
          <a className="menu-link" href="https://github.com/oseiskar"><FontAwesomeIcon icon={faGithub} className="menu-icon" />Code</a>
          <a className="menu-link" href="https://scholar.google.com/citations?user=6fr78PEAAAAJ"><FontAwesomeIcon icon={faGoogleScholar} className="menu-icon" />Publications</a>
            <a className="menu-link" href="https://www.linkedin.com/in/otto-seiskari/"><FontAwesomeIcon icon={faLinkedin} className="menu-icon" />Work</a>
            <a className="menu-link" href="https://www.instagram.com/oseiskar/"><FontAwesomeIcon icon={faInstagram} className="menu-icon" />Graphics</a>
          </div>
          <div className="mt-6 icon-links">
            <span className="text-sm aside-small-texts mr-2">Follow:</span>
            <a className="icon-link" href="https://twitter.com/oseiskar"><FontAwesomeIcon icon={faXTwitter} className="misc-icon" /></a>
            <a className="icon-link" href="https://bsky.app/profile/oseiskar.bsky.social"><FontAwesomeIcon icon={faBluesky} className="misc-icon" /></a>
            <a className="icon-link" href="https://stackoverflow.com/users/1426569/oseiskar"><FontAwesomeIcon icon={faStackOverflow} className="misc-icon" /> </a>
            <a className="icon-link" href="https://www.kaggle.com/oseiskar"><FontAwesomeIcon icon={faKaggle} className="misc-icon" /></a>
            <a className="icon-link" href="https://medium.com/@oseiskar"><FontAwesomeIcon icon={faMedium} className="misc-icon" /></a>
          </div>
        </div>
      </aside>

      {/* 
        Right Column (Main Content)
      */}
      <section className="flex-1 lg:pl-12 px-6">
        <h1>Featured open source projects</h1>
        <div className="flex flex-wrap items-center justify-around xl:justify-between w-full">
        <ShortGithubProject
          name="SIMD Kalman"
          repo="oseiskar/simdkalman"
          image="img/simdkalman.png"
          stars={true}
          pypi="simdkalman"
          url="https://simdkalman.readthedocs.io/en/latest/"
          description="
            Fast Kalman filters in Python leveraging single-instruction multiple-data vectorization.
            That is, running n similar Kalman filters on n independent series of observations."/>
        <ShortGithubProject
          name="Autosubsync"
          repo="oseiskar/autosubsync"
          stars={true}
          image="https://repository-images.githubusercontent.com/150953681/4b9f925d-37c5-45ec-829f-89b69466ba49"
          url="https://github.com/oseiskar/autosubsync"
          description="
            Automatically synchronize SRT subtitles with audio using AI &amp; Machine Learning.
            Automatic speed and shift correction, typical synchronization accuracy ~0.15 seconds.
            Available as a Python package."/>
        <ShortGithubProject
          name="Corona Sniffer"
          repo="oseiskar/corona-sniffer"
          stars={true}
          image="https://repository-images.githubusercontent.com/259749452/1f154800-8eb3-11ea-8824-2a31bc68aa84"
          url="https://github.com/oseiskar/corona-sniffer"
          description="
            How anonymous is the Apple/Google BLE contract tracing system (GAEN/ENS)? A proof-of-concept BLE sniffing attack against the system."/>
        <GithubProject
          name="Black Hole"
          repo="oseiskar/black-hole"
          image="img/black-hole.jpg"
          stars={true}
          url="https://oseiskar.github.io/black-hole"
          description="
            A real time ray-traced simulation of a Schwarzschild black hole using THREE.js.
            The contributions of various special and general relativistic effects can be toggled from the GUI."/>
        <GithubProject
          name="HybVIO"
          repo="SpectacularAI/HybVIO"
          image="https://repository-images.githubusercontent.com/431543298/b2635e09-464a-47b3-ad18-cb138a51c820"
          stars={true}
          url="https://arxiv.org/abs/2106.11857"
          description="
            Real-time visual-inertial SLAM system with excellent performance in academic benchmarks and custom vehicular data. Developed at Spectacular AI and Published in WACV '22."/>
        <GithubProject
          name="WebGL Raytracer"
          repo="oseiskar/webgl-raytracer"
          image="img/webgl-raytracer.png"
          stars={true}
          url="https://oseiskar.github.io/webgl-raytracer"
          description="
            Run a GPU-powered bidirectional raytracer in the browser and experiment with different
            scenes and rendering options. GPGPU now possible
            without spending hours installing CUDA!"/>
        <GithubProject
          name="JS car"
          repo="oseiskar/js-car"
          stars={true}
          image="https://repository-images.githubusercontent.com/172246214/c09becb4-7529-400f-9e7a-4c2467156f43"
          url="https://oseiskar.github.io/js-car"
          description="
            JavaScript 2D car dynamics simulation. The physics model is as simple as possible:
            Frictional forces are applied to two points: the center of the front and
            rear axle."/>
        <GithubProject
          name="Tree of Life"
          repo="oseiskar/tree-of-life"
          image="img/tree-of-life.png"
          stars={true}
          url="https://oseiskar.github.io/tree-of-life"
          description="
            An interactive visualization of the Open Tree of Life using d3.js.
            The entire tree with approximately 2.3 million identified species as
            leaf nodes is browsable through the application."/>
        <GithubProject
          name="Puzzles"
          repo="oseiskar/puzzles"
          image="https://repository-images.githubusercontent.com/48693032/cc2b23c7-b738-410e-b013-b7eb547c29d1"
          url="https://oseiskar.github.io/puzzles"
          description="Archive of ad hoc algorithmic solutions to physical puzzle games. Mostly throwaway-quality code, some of which only runs with Python 2."/>
        <GithubProject
          name="Mersenne Twister"
          repo="oseiskar/mersenne-twister"
          image="img/mersenne-twister.png"
          url="https://oseiskar.github.io/mersenne-twister"
          description="
            Can you spot the difference between the C random number generator
            and Mersenne Twister?"/>
        {
          false && <div>
            <ShortGithubProject
              name="Baro floor height"
              repo="oseiskar/BaroFloorHeight"
              image="img/baro-floor-height.png"
              url="https://play.google.com/store/apps/details?id=xyz.osei.baro&hl=en"
              description="
              An Andoid app for measuring the height of storeys and buildings using the barometer."/>
            <ShortGithubProject
              name="QR cloner"
              repo="oseiskar/qrcloner"
              image="https://repository-images.githubusercontent.com/418668632/a1fbe5b1-1957-4329-a494-254e19dfac26"
              url="https://github.com/oseiskar/qr-cloner"
              description="
                Scan a QR code to move it from your computer screen or a printed paper to your phone.
                The code is saved on the phone and can later be displayed to QR code scanners."/>
          </div>
        }
        </div>
      </section>
    </main>
  );
}
