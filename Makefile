init:
	npm install --dev
	npx husky-init
	npx husky add .husky/pre-commit "npm run lint && npm run fix"

release_from-develop:
	gh pr create --base main --head develop --title "Release v$(version)" --body "Released: v$(version)"
	gh pr merge --auto
	gh release create $(version) --target main --latest --generate-notes --title "$(version)"

post-release:
	rm -rf dist
	git add .
	git commit -m 'release: $(version)'
	git push origin develop
	make release_from-develop version=$(version)

lint:
	npx eslint --fix 'src/**/*.{js,ts}'

prettier:
	npx prettier --write 'src/**/*.{js,ts}'

PHONY: release_from-develop post-release lint prettier
