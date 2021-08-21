export default function GithubProject(props) {
  return (
    <div className="lg:w-full lg:flex shadow-2xl mt-4 mb-4">
      <div
        className="h-72 lg:w-1/3 flex-none bg-auto bg-center rounded-t rounded-t-none rounded-l overflow-hidden"
        style={{ backgroundImage: "url('img/" + props.image + "')" }}>
      </div>
      <div className="bg-white rounded-b rounded-b-none rounded-r p-4 lg:flex lg:flex-col">
        <div className="mb-8 mt-6 mr-4 ml-8">
          <h3 className="text-2xl font-bold">{props.name}</h3>
          <p className="mt-4 md:text-xl">
          {props.description}
          </p>
        </div>
      </div>
    </div>
  )
}
