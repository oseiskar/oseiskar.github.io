import { FaGithub } from 'react-icons/fa';

function ghStars(props, extraClass='') {
  return <a className={'text-2xl text-gray-500 ' + extraClass } href={ 'https://github.com/' + props.repo }>
    { props.stars &&
      <img className="mt-2 lg:mt-1" alt="GitHub Repo stars" src={ 'https://img.shields.io/github/stars/' + props.repo }/>
    }
    { !props.stars && <span class="text-lg xl:text-xl inline-block"><FaGithub/></span> }
  </a>
}

function sideStars(props) {
  return <div className="w-40 hidden xl:flex">
    { ghStars(props, 'ml-8 mt-2') }
  </div>
}

export function GithubProject(props) {
  return (
    <div className="flex sm:flex-row flex-col w-full mb-6 mt-4">
      <div className="flex-1">
        <div className="pb-2 pr-4 sm:pr-8 xl:pr-12 lg:mt-2">
          <div className="flex flex-row">
            <a className="text-lg lg:text-xl font-bold flex-grow" href={ props.url }>{props.name}</a>
            { ghStars(props, "flex-none xl:hidden") }
          </div>
          <p className="my-3 text-sm sm:text-base">
            {props.description}
          </p>
        </div>
      </div>
      <a href={ props.url }
        className="w-full sm:w-64 h-52 sm:h-40 bg-cover bg-center inline-block rounded-lg shadow-lg"
        style={{ backgroundImage: "url('" + props.image + "')" }}>
      </a>
      {sideStars(props)}
    </div>
  )
}

export function ShortGithubProject(props) {
  return (
    <div className="flex flex-row w-full mb-6">
      <div className="w-40 lg:w-48">
        <a className="text-lg lg:text-xl font-bold" href={ props.url }>{props.name}</a>
        <span className="xl:hidden">
          { ghStars(props) }
        </span>
      </div>
      <div className="flex-1">
        <div className="">
          <div className="w-full flex">
            <a className="flex-none text-2xl text-gray-500" href={ 'https://github.com/oseiskar/' + props.repo }>
            </a>
          </div>
          <p className="text-sm sm:text-base">
          {props.description}
          </p>
        </div>
      </div>
      {sideStars(props)}
    </div>
  )
}

export default ShortGithubProject;