import { FaGithub } from 'react-icons/fa';

export default function GithubProject(props) {
  return (
    <div className="max-w-[38rem] w-full xl:w-[48%] transition duration-500 ease-in-out xl:hover:scale-105 xl:mb-12">
      <div className="w-full mb-6 mt-4 xl:m-0">
        <a href={ props.url }
          className="h-72 w-full bg-auto bg-center rounded-none rounded-t-xl inline-block"
          style={{ backgroundImage: "url('" + props.image + "')" }}>
        </a>
        <div className="-mt-2 xl:h-60 bg-white rounded-b-xl rounded-t-none p-2 md:py-3 shadow-xl bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900 border-t border-gray-200">
          <div className="mb-8 mt-6 mr-4 ml-8">
            <div className="full-w flex">
              <a className="text-2xl font-bold flex-grow hover:text-blue-700" href={ props.url }>{props.name}</a>
              { props.pypi &&
              <a className="flex-none hover:text-blue-700 text-2xl text-gray-500" href={ 'https://pypi.python.org/pypi/' + props.pypi }>
                <img className="mt-1 mr-2" alt="PyPI downloads" src={ 'https://img.shields.io/pypi/dm/' + props.pypi + "?color=%233b82f6" }/>
              </a>
              }
              <a className="flex-none hover:text-blue-700 text-2xl text-gray-500" href={ 'https://github.com/oseiskar/' + props.repo }>
              { props.stars &&
                <img className="mt-1" alt="GitHub Repo stars" src={ 'https://img.shields.io/github/stars/oseiskar/' + props.repo + "?color=%233b82f6" }/>
              }
              { !props.stars && <FaGithub/> }
              </a>
            </div>
            <p className="mt-4 md:text-lg">
            {props.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
