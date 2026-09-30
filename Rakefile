require "rake"
require "digest"
require "fileutils"
require "shellwords"
require "tmpdir"

if File.file?(".env")
  File.foreach(".env") do |line|
    key, value = line.strip.split("=", 2)
    next if key.to_s.empty? || key.start_with?("#") || value.nil?

    value = value.strip
    value = value[1...-1] if value.length >= 2 && value.start_with?("\"", "'") && value.end_with?("\"", "'")
    ENV[key] ||= value
  end
end

GITHUB_PAGES_BRANCH = "gh-pages"
PLATFORM = "--platform linux/amd64"
JEKYLL_IMAGE = "jekyll/jekyll:latest"
REPO_DIR = File.expand_path(__dir__)
BUILD_DIR = "#{REPO_DIR}_site"
PAGES_DIR = "#{REPO_DIR}_#{GITHUB_PAGES_BRANCH}"

def sync_changed_files(source_dir, target_dir)
  source_paths = Dir.glob("#{source_dir}/**/*", File::FNM_DOTMATCH)
    .reject { |path| [ ".", ".." ].include? File.basename(path) }
    .reject { |path| File.directory?(path) }
    .map { |path| path.delete_prefix("#{source_dir}/") }
    .reject { |path| path == ".github/actions" || path.start_with?(".github/actions/") }

  target_paths = Dir.glob("#{target_dir}/**/*", File::FNM_DOTMATCH)
    .reject { |path| [ ".", ".." ].include? File.basename(path) }
    .reject { |path| File.directory?(path) }
    .map { |path| path.delete_prefix("#{target_dir}/") }
    .reject { |path| path == ".git" || path.start_with?(".git/") }

  (target_paths - source_paths).each do |relative_path|
    FileUtils.rm_f File.join(target_dir, relative_path)
  end

  source_paths.each do |relative_path|
    source_path = File.join(source_dir, relative_path)
    target_path = File.join(target_dir, relative_path)

    next if File.file?(target_path) && Digest::SHA256.file(source_path).hexdigest == Digest::SHA256.file(target_path).hexdigest

    FileUtils.mkdir_p File.dirname(target_path)
    FileUtils.cp source_path, target_path
  end
end

desc "Build the site with Jekyll"
task :build, [ :baseurl ] do |task, args|
  baseurl = args[:baseurl] || ""
  if ENV["LP_USE_DOCKER_INSTEAD_OF_LOCAL_RUBY"] == "true"
    # TODO: does not work on macOS
    sh <<~HERE_DOC
      docker run --rm \
        #{PLATFORM} \
        --volume "#{REPO_DIR}:/srv/jekyll" \
        --volume "#{BUILD_DIR}:/srv/jekyll/_site" \
        -w /srv/jekyll \
        #{JEKYLL_IMAGE} \
        jekyll build \
        --baseurl '#{baseurl}'
    HERE_DOC
  else
    sh "bundle install"
    sh "bundle exec jekyll build -d #{BUILD_DIR} --baseurl '#{baseurl}'"
  end
end

desc "Commit source code to main, rebase, and push"
task :commit_and_push_with_rebase do
  rebase_in_progress = File.directory?(File.join(REPO_DIR, ".git", "rebase-merge")) ||
    File.directory?(File.join(REPO_DIR, ".git", "rebase-apply"))

  if rebase_in_progress
    sh "git add ."
    sh "GIT_EDITOR=true git rebase --continue"
  else
    sh "git add ."
    sh %(git commit -m "Update source site content" || echo 'Nothing to commit on main')

    if system("git ls-remote --exit-code --heads origin main >/dev/null 2>&1")
      sh "git pull --rebase origin main"
    else
      puts "No main branch on remote yet; skipping pull."
    end
  end

  sh "git push origin main"
end

desc "Deploy to #{GITHUB_PAGES_BRANCH} branch using a cached checkout (does not touch #{BUILD_DIR})"
task :deploy do
  origin = `git config --get remote.origin.url`.strip
  fail "origin is empty" if origin.empty?
  pages_origin = ENV["GH_PAGES_REPO_URL_IF_DIFFERENT_FROM_REPO_URL"].to_s.strip
  pages_origin = origin if pages_origin.empty?
  pages_origin_arg = Shellwords.escape(pages_origin)

  Dir.mktmpdir do |build_dir|
    if ENV["LP_USE_DOCKER_INSTEAD_OF_LOCAL_RUBY"] == "true"
      sh <<~HERE_DOC
        docker run --rm \
          #{PLATFORM} \
          --volume "#{REPO_DIR}:/srv/jekyll" \
          --volume "#{build_dir}:/srv/jekyll/_site" \
          -w /srv/jekyll \
          #{JEKYLL_IMAGE} \
          jekyll build
      HERE_DOC
    else
      sh "bundle exec jekyll build -d #{build_dir}"
    end

    pages_checkout_created = false
    unless File.directory?(File.join(PAGES_DIR, ".git"))
      if system("git clone --branch #{GITHUB_PAGES_BRANCH} --single-branch #{pages_origin_arg} #{PAGES_DIR}")
        puts "Cloned #{GITHUB_PAGES_BRANCH} to #{PAGES_DIR}"
        pages_checkout_created = true
      else
        FileUtils.mkdir_p PAGES_DIR
        Dir.chdir PAGES_DIR do
          sh "git init"
          sh "git checkout --orphan #{GITHUB_PAGES_BRANCH}"
          sh "git remote add origin #{pages_origin_arg}"
        end
        pages_checkout_created = true
      end
    end

    Dir.chdir PAGES_DIR do
      sh "git remote set-url origin #{pages_origin_arg}"
      current_branch = `git branch --show-current`.strip
      sh "git checkout #{GITHUB_PAGES_BRANCH}" unless current_branch == GITHUB_PAGES_BRANCH
      unless pages_checkout_created
        # The generated site is authoritative; discard local divergence in the
        # cached checkout before syncing _site files.
        sh "git fetch origin #{GITHUB_PAGES_BRANCH}"
        sh "git reset --hard origin/#{GITHUB_PAGES_BRANCH}"
      end

      sync_changed_files build_dir, PAGES_DIR

      sh "git add -A"
      if system("git diff --cached --quiet")
        puts "No changes to publish on #{GITHUB_PAGES_BRANCH}"
        next
      end

      sh "git commit -m 'Site updated at #{Time.now.utc}'"

      puts "Pushing to #{pages_origin}"
      sh "git push --force-with-lease origin #{GITHUB_PAGES_BRANCH}"
    end
  end
end

desc "Full deploy: commit source and publish site"
task commit_and_push: [ :commit_and_push_with_rebase, :deploy ]

desc "Pull the repo"
task :pull do |task, args|
  has_local_changes = !`git status --porcelain`.empty?

  unless has_local_changes
    sh "git pull --rebase"
    next
  end

  sh "git stash push --include-untracked -m 'Temporary stash for litepage pull'"
  sh "git pull --rebase"
  sh "git stash pop"
end
