export default function GithubProject(props) {
  return (
    <div className="full-w lg:w-1/2 transition duration-500 ease-in-out lg:scale-90 hover:scale-100">
      <div className="full-w mb-6 mt-4 lg:m-0">
        <div
          className="h-72 flex-none bg-auto bg-center rounded-non rounded-t-xl overflow-hidden shadow-xl"
          style={{ backgroundImage: "url('img/" + props.image + "')" }}>
        </div>
        <div className="lg:h-72 bg-white rounded-b-xl rounded-t-none p-4 shadow-xl bg-gradient-to-r from-gray-100 to-gray-200 text-gray-900 border-t border-gray-200">
          <div className="mb-8 mt-6 mr-4 ml-8">
            <h3 className="text-2xl font-bold">{props.name}</h3>
            <p className="mt-4 md:text-xl">
            {props.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
