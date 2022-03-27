import { FaGithub } from 'react-icons/fa';

export default function ShortGithubProject(props) {
  return (
    <div className="md:max-w-[38rem] grid grid-cols-12 mb-12 w-full">
      <a href={ props.url }
        className="col-span-4 h-48 w-full bg-cover bg-center inline-block rounded-lg shadow-lg"
        style={{ backgroundImage: "url('" + props.image + "')" }}>
      </a>
      <div className="col-span-8 flex h-48 pl-6 xl:pl-12 pt-2 -mt-2 mt-0 rounded-bl-lg">
        <div className="pb-6 w-full">
          <div className="w-full flex">
            <a className="text-xl lg:text-2xl font-bold flex-grow hover:text-blue-700" href={ props.url }>{props.name}</a>
            <a className="flex-none hover:text-blue-700 text-2xl text-gray-500" href={ 'https://github.com/oseiskar/' + props.repo }>
            { props.stars &&
              <img className="mt-1" alt="GitHub Repo stars" src={ 'https://img.shields.io/github/stars/oseiskar/' + props.repo }/>
            }
            { !props.stars && <FaGithub/> }
            </a>
           </div>
          <p className="mt-4 text-sm md:text-base">
          {props.description}
          </p>
         </div>
       </div>
    </div>
  )
}
