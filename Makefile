release_from-develop:
	gh pr create --base main --head develop --title "Release v$(version)" --body "Released: v$(version)"
	gh pr merge --auto
	gh release create $(version) --target main --latest --generate-notes --title "$(version)"

make post-release:
	rm -rf dist
	git add .
	git commit -m 'release: $(version)'
	git push origin develop
	make release_from-develop version=$(version)

PHONY: release_from-develop post-release
