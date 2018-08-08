const CACHED_SOLC_VERSIONS = new Set(['soljson-v0.4.24+commit.e67f0147.js']);

const COMPILER = {
    latestResult: null,
    currentVersion: 0,
    compiler: null,
    versions: [],
    init: function(cb) {
        let self = this;
        BrowserSolc.getVersions((a,b) => {
            self.versions = Object.freeze(Object.entries(b));
            this.setSelectedVersion(0, cb);
        });
    },
    setSelectedVersion: function(idx, cb) {
        let version = this.versions[idx];
        if (!version) {
            throw "no solc version found with idx: " + idx;
        }
        console.log('Switchin current solc version to: ' + version + ' (idx ' + idx + ')');
        let self = this;
        BrowserSolc.loadVersion(version[1], c => {
            self.compiler = c;
            this.currentVersion = idx;
            if (cb) { cb(version); }
        }, CACHED_SOLC_VERSIONS.has(version[1]) ? `assets/js/solc-bin/${version[1]}` : undefined);
    },
    getSelectedVersion: function() {
        if (!this.versions) {
            throw "no solc versions available yet!";
        }
        if (this.currentVersion < 0) {
            throw "no solc version is selected!"
        }
        if (this.currentVersion > this.versions.length) {
            throw "illegal solc version is selected: " + this.currentVersion;
        }
        return this.versions[this.currentVersion];
    },
    compile: function(source, optimise=1) {
        let compiler = this.compiler;
        if (!compiler) {
            throw "solc compiler not found for version: " + version;
        }
        return compiler.compile(source, optimise);
    }
};