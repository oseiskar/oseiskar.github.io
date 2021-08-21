import { FaGithub } from 'react-icons/fa';

export default function GithubProject(props) {
  return (
    <a className="full-w lg:w-1/2 transition duration-500 ease-in-out lg:scale-90 hover:scale-100" href={ props.url }>
      <div className="full-w mb-6 mt-4 lg:m-0">
        <div
          className="h-72 flex-none bg-auto bg-center rounded-non rounded-t-xl overflow-hidden shadow-xl"
          style={{ backgroundImage: "url('" + props.image + "')" }}>
        </div>
        <div className="lg:h-72 bg-white rounded-b-xl rounded-t-none p-4 shadow-xl bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900 border-t border-gray-200">
          <div className="mb-8 mt-6 mr-4 ml-8">
            <div className="full-w flex">
              <h3 className="text-2xl font-bold flex-grow">{props.name}</h3>
              <a className="flex-none hover:text-blue-700 text-2xl text-gray-500" href={ 'https://github.com/oseiskar/' + props.repo }><FaGithub/></a>
            </div>
            <p className="mt-4 md:text-xl">
            {props.description}
            </p>
          </div>
        </div>
      </div>
    </a>
  )
}
