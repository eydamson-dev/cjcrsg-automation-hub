import { PostForm } from '@/components/post-form'

export default function NewPostPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New post</h1>
      <PostForm />
    </div>
  )
}