// const Network = Object.freeze(new Web3NetworkConstructor('https://kevm-testnet.iohkdev.io:8546', 'Cardano Test-Net'));
const Network = Object.freeze(new MockNetworkConstructor());

const FAUCET_MAX_PENDING_REQUESTS = 10;

function appendAccountToWorkspace(acc) {
    STATE.accounts.push({
        pk: acc.privateKey,
        acc: acc
    });
    STATE.selectedAccount = acc.address;
    VIEW.AccSelector.addAndSelectAddress(acc.address);
    updateBalance();
}

function addAccountRandomizeKey() {
    VIEW.AddAccountModal.privateKey(Util.newRandomPrivateKey());
}

function accountRemoveSetAddress(address = STATE.selectedAccount) {
    VIEW.RemoveAccountModal.address(address);
}

function accountCoinsSetAddress(address = STATE.selectedAccount) {
    VIEW.GetCoinsModal.address(address);
}

function updateBalance(address = STATE.selectedAccount) {
    if (VIEW.AccSelector.selectedAddress() === address) {
        VIEW.AccSelector.balance('...');
    }
    Network.getBalance(address, r => {
        console.log('Received balance: ' + r);
        if (VIEW.AccSelector.selectedAddress() === address) {
            VIEW.AccSelector.balance(r);
        }
    });
}

function updateAccountRemoveButtonAvailability() {
    let selectedAccountRequests = STATE.faucet.queue.find((r) => r.address === STATE.selectedAccount);
    VIEW.RemoveAccountModal.initEnabled(!selectedAccountRequests);
}

function updateFaucetButtonAvailability() {
    VIEW.GetCoinsModal.submitEnabled(
        STATE.faucet.queue.length < FAUCET_MAX_PENDING_REQUESTS);
}

function queueFaucetRequest(address) {
    let request = STATE.faucet.pushRequest(address);
    updateFaucetButtonAvailability();
    updateAccountRemoveButtonAvailability();
    if (STATE.faucet.queue.length === 1) {
        function requestWorker(req) {
            let timeout = req.expectedRequestMillis - new Date().getTime();
            setTimeout(function () {
                let currentMillis = new Date().getTime();
                if (STATE.faucet.queue.length === 0 || STATE.faucet.queue[0].id !== req.id) {
                    return;
                }
                console.log('Requesting faucet for: ', req);
                STATE.faucet.lastRequestMillis = req.requestMillis = currentMillis;
                VIEW.GetCoinsModal.markRequestBeginning(req);
                // mock request
                Network.faucetRequest(req.address, function (tx) {
                    console.log('Received faucet tx id: ' + tx);
                    VIEW.GetCoinsModal.markRequestTxCreated(req, tx);
                    Network.getTransactionReceiptMined(tx).then(function (tx) {
                        console.log('Received faucet tx: ', tx);
                        if (VIEW.AccSelector.selectedAddress() === req.address) {
                            updateBalance(req.address);
                        }
                        if (STATE.faucet.queue.length === 0 || STATE.faucet.queue[0].id !== req.id) {
                            return;
                        }
                        STATE.faucet.queue.splice(0,1);
                        VIEW.GetCoinsModal.removeQueueRequest(req);
                        updateFaucetButtonAvailability();
                        updateAccountRemoveButtonAvailability();
                        if (STATE.faucet.queue.length > 0) {
                            requestWorker(STATE.faucet.queue[0]);
                        }
                    });
                });
            }, timeout);
        }
        requestWorker(request);
    }
    VIEW.GetCoinsModal.addQueueRequest(request);
}

function deployContract(name) {
    if (!COMPILER.latestResult) {
        console.log('No latest compilation result is available!');
        return;
    }
    let contractResult = COMPILER.latestResult.contracts[name];
    if (!contractResult) {
        console.log('No contract found with the name: ' + name, COMPILER.latestResult);
        return;
    }
    VIEW.Editor.setEditorEnabled(false);
    let address = STATE.selectedAccount;
    Network.prepareDeploy(address, contractResult, function (prep, err) {
        if (err) {
            console.error('Failed to prepare contract deploy!', err);
            return;
        }
        VIEW.DeployContractModal.showModal(address, name, prep.gasEstimate, function ({gasLimit, gasPrice}) {
            prep.send({from: address, gas: gasLimit, gasPrice: gasPrice}, function (error, res) {
                if (error) {
                    console.error(error.reason, error.cause);
                } else {
                    console.log('Deploy result > ', res);
                }
                setTimeout(function () {
                    updateBalance(address);
                }, 3000);
                VIEW.Editor.setEditorEnabled(true);
            });
        });
    });
}

function compileCurrentCode() {
    VIEW.Editor.setEditorEnabled(false);
    setTimeout(() => {
        let code = VIEW.Editor.ace.getValue();
        let ver = COMPILER.getSelectedVersion()[1];
        let res = COMPILER.compile(code);
        console.log('Compiled result: ', res);
        let annotations = [];
        if (res.errors) {
            annotations = res.errors.map((s) => {
                let pref = s.split(' ', 1)[0];
                let coords = pref.split(':');
                if (coords[0] || coords[3]) {
                    console.warn('COORDINATES! ' + s);
                }
                let message = s.substr(pref.length+1).replace(new RegExp('↵', 'g'),'\n').trim();
                return {row: parseInt(coords[1])-1, column: parseInt(coords[2])-1, text: message, type: 'error'};
            });
        } else {
            COMPILER.latestResult = res;
            let contracts = Object.entries(res.contracts).map(function (e) {
                let estimates = e[1].gasEstimates;
                let hash = Util.sha1(e[1].bytecode.dropTail(68)).substr(-16);
                let methods = Object.entries(estimates.external).map(function (e) {
                    return {name: e[0], gas: e[1]}
                });
                return {name: e[0], gas: estimates.creation, hash: hash, methods: methods};
            });
            let totalHash = Util.sha1('' + contracts.map(c => c.hash)).substr(-32);
            VIEW.Editor.setStructureCards({
                compiledAt: new Date().toISOString(),
                compiler: ver,
                hash: totalHash,
                contracts: contracts
            });
        }
        VIEW.Editor.ace.session.setAnnotations(annotations);
        VIEW.Editor.setEditorEnabled(true);
    }, 100);
}

$(function() {

    STATE.init();
    VIEW.init();

    COMPILER.init(function (version) {
        VIEW.Editor.setSolcVersions(COMPILER.versions.map(v => v[0]));
        VIEW.Editor.selectedSolcVersion(version[0]);
        compileCurrentCode();
    });

    $.each(STATE.accounts, (i, account) => {
        VIEW.AccSelector.addAddress(account.acc.address)
    });

    if (STATE.selectedAccount) {
        VIEW.AccSelector.selectedAddress(STATE.selectedAccount);
    } else {
        STATE.selectedAccount = VIEW.AccSelector.selectedAddress();
        console.log('Init selected account: ', STATE.selectedAccount);
    }

    function onAccountSelectorChange() {
        let addr = VIEW.AccSelector.selectedAddress();
        STATE.selectedAccount = addr;
        updateAccountRemoveButtonAvailability();
        updateBalance(addr);
    }

    updateBalance();
    VIEW.AccSelector.el_selector.change(onAccountSelectorChange);
    VIEW.AccSelector.el_reload_btn.click(() => updateBalance());

    VIEW.AddAccountModal.el_pk_input.on('change paste keyup', function (e) {
        let val = VIEW.AddAccountModal.privateKey();
        if (val.length === 64 && Network.web3.utils.isHex(val)) {
            VIEW.AddAccountModal.markInputError();
        } else {
            VIEW.AddAccountModal.markInputError('Invalid Ethereum private key');
            return;
        }
        if (STATE.accounts.find(a => a.acc.privateKey.endsWith(val))) {
            VIEW.AddAccountModal.markInputError('This account is already added');
        }
    });

    function updateRemoveAccountAvailability() {
        VIEW.RemoveAccountModal.el_init_btn.attr('disabled', STATE.accounts.length < 2);
    }

    VIEW.AddAccountModal.el_submit_btn.click(function (e) {
        if (VIEW.AddAccountModal.hasInputError()) {
            return;
        }
        let acc;
        try {
            acc = Network.recoverAcc('0x' + VIEW.AddAccountModal.privateKey());
        } catch (e) {
            console.error('Failed to create account from a private key!', {pk: VIEW.AddAccountModal.privateKey(), err: e});
            VIEW.AddAccountModal.markInputError('Invalid key: failed to create an account');
            return;
        }
        appendAccountToWorkspace(acc);
        updateRemoveAccountAvailability();
        VIEW.AddAccountModal.closeModal();
    });

    updateRemoveAccountAvailability();
    VIEW.RemoveAccountModal.el_submit_btn.click(function (e) {
        let address = VIEW.RemoveAccountModal.address();
        if (confirm('Delete account ' + address + "?")) {
            console.log('Removing account: ' + address);
            $('#account-selector option[key=' + address + ']').remove();
            Util.removeFirstIf(STATE.accounts, (a) => a.acc.address === address);
            Network.removeAcc(address);
            onAccountSelectorChange();
            updateRemoveAccountAvailability();
        }
        VIEW.RemoveAccountModal.closeModal();
    });

    VIEW.GetCoinsModal.el_submit_btn.click(function (e) {
        queueFaucetRequest(VIEW.GetCoinsModal.address());
    });

    function clearAutoCompileTimeout() {
        if (VIEW.Editor.editTimeout) {
            clearTimeout(VIEW.Editor.editTimeout);
        }
    }

    function restartAutoCompileTimeout() {
        clearAutoCompileTimeout();
        VIEW.Editor.editTimeout = setTimeout(function () {
            compileCurrentCode();
        }, 3000);
    }

    VIEW.Editor.ace.session.on('change', function(delta) {
        if (STATE.editor.autoCompile) {
            restartAutoCompileTimeout();
        }
    });

    VIEW.Editor.ace.session.selection.on('changeCursor', function(delta) {
        if (STATE.editor.autoCompile && VIEW.Editor.editTimeout) {
            restartAutoCompileTimeout();
        }
    });

    function onCompileCommand() {
        if (!STATE.editor.autoCompile) {
            compileCurrentCode();
        }
    }

    VIEW.Editor.ace.commands.addCommand({
        name: 'compile',
        bindKey: {win: 'Ctrl-S',  mac: 'Command-S'},
        exec: onCompileCommand,
        readOnly: false // false if this command should not apply in readOnly mode
    });

    VIEW.Editor.el_compile_btn.click(onCompileCommand);

    VIEW.Editor.el_autocompile_check.change(function () {
        let val = $(this).is(':checked');
        console.log('Auto-compile is ' + (val ? 'on' : 'off'));
        STATE.editor.autoCompile = val;
        if (val) {
            VIEW.Editor.setCompileButtonAvailable(false);
            restartAutoCompileTimeout();
        } else {
            clearAutoCompileTimeout();
            VIEW.Editor.setCompileButtonAvailable(true);
        }
    });

    VIEW.Editor.el_solc_selector.change(function () {
        let idx = parseInt($(this).find('option:selected').attr('idx'));
        VIEW.Editor.setEditorEnabled(false);
        COMPILER.setSelectedVersion(idx, () => {
            VIEW.Editor.setEditorEnabled(true);
        });
    });
});