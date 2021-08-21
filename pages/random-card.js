export default function GithubProject(props) {
  return (
    <a
      href="https://nextjs.org/docs"
      className="p-6 mt-6 text-left w-96 rounded-xl h bg-gradient-to-r from-gray-200 to-gray-300 shadow-2xl"
    >
      <h3 className="text-2xl font-bold">{props.name}</h3>
      <p className="mt-4 text-xl">
        Find in-depth information about Next.js features and API.
      </p>
    </a>
  )
}
