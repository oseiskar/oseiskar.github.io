import { FaGithub } from 'react-icons/fa';

function ghStars(props, extraClass='') {
  return <a className={'text-2xl text-gray-500 ' + extraClass } href={ 'https://github.com/oseiskar/' + props.repo }>
    { props.stars &&
      <img className="mt-2 lg:mt-1" alt="GitHub Repo stars" src={ 'https://img.shields.io/github/stars/oseiskar/' + props.repo }/>
    }
    { !props.stars && <span class="text-lg lg:text-xl hidden lg:inline-block"><FaGithub/></span> }
  </a>
}

export function GithubProject(props) {
  return (
    <div className="flex flex-row w-full mb-6">
      <div className="flex-1">
        <div className="pb-6 pr-4 sm:pr-6 lg:mt-4">
          <a className="text-lg lg:text-xl flex-grow font-bold hover:text-blue-700" href={ props.url }>{props.name}</a>
          <p className="my-3 text-sm sm:text-base">
            {props.description}
          </p>
          <span className="lg:hidden">
            { ghStars(props) }
          </span>
        </div>
      </div>
      <a href={ props.url }
        className="w-40 lg:w-64 lg:h-40 bg-cover bg-center inline-block rounded-lg shadow-lg"
        style={{ backgroundImage: "url('" + props.image + "')" }}>
      </a>
      <div className="lg:w-40 hidden lg:flex">
        { ghStars(props, 'ml-12 mt-4') }
      </div>
    </div>
  )
}

export function ShortGithubProject(props) {
  return (
    <div className="flex flex-row w-full mb-6">
      <div className="w-40 lg:w-48">
        <a className="text-lg lg:text-xl font-bold" href={ props.url }>{props.name}</a>
        <span className="lg:hidden">
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
      <div className="lg:w-40 hidden lg:flex">
        { ghStars(props, 'ml-12 mt-2') }
      </div>
    </div>
  )
}

export default ShortGithubProject;