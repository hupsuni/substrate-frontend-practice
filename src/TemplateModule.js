// React and Semantic UI elements.
import React, { useEffect, useState } from 'react';
import { Form, Input, Grid, Card, Statistic, Message } from 'semantic-ui-react';
// Pre-built Substrate front-end utilities for connecting to a node
// and making a transaction.
import { useSubstrate } from './substrate-lib';
import { TxButton } from './substrate-lib/components';
// Polkadot-JS utilities for hashing data.
import { blake2AsHex } from '@polkadot/util-crypto';

function Main (props) {
    // Establish an API to talk to our Substrate node.
    const { api } = useSubstrate();
    // Get the selected user from the `AccountSelector` component.
    const { accountPair } = props;
    // The transaction submission status
    const [status, setStatus] = useState('');
    // React hooks for all the state variables we track.
    // Learn more at: https://reactjs.org/docs/hooks-intro.html
    const [digest, setDigest] = useState('');
    const [owner, setOwner] = useState('');
    const [block, setBlock] = useState(0);
    // The currently stored value
    const [currentValue, setCurrentValue] = useState(0);
    const [formValue, setFormValue] = useState(0);
    
    // Our `FileReader()` which is accessible from our functions below.
    let fileReader;
    
    // Takes our file, and creates a digest using the Blake2 256 hash function.
    const bufferToDigest = () => {
        // Turns the file content to a hexadecimal representation.
        const content = Array.from(new Uint8Array(fileReader.result))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        
        const hash = blake2AsHex(content, 256);
        setDigest(hash);
    };
    
    // React hook to update the owner and block number information for a file.
    useEffect(() => {
        let unsubscribe;
        api.query.templateModule.something(newValue => {
            // The storage value is an Option<u32>
            // So we have to check whether it is None first
            // There is also unwrapOr
            if (newValue.isNone) {
                setCurrentValue('<None>');
            } else {
                setCurrentValue(newValue.unwrap().toNumber());
            }
        }).then(unsub => {
            unsubscribe = unsub;
        }).catch(console.error);
        
        // Polkadot-JS API query to the `proofs` storage item in our pallet.
        // This is a subscription, so it will always get the latest value,
        // even if it changes.
        api.query.templateModule.proofs(digest, (result) => {
            // Our storage item returns a tuple, which is represented as an array.
            setOwner(result[0].toString());
            setBlock(result[1].toNumber());
        }).then((unsub) => {
            unsubscribe = unsub;
        });
        
        return () => unsubscribe && unsubscribe();
        // This tells the React hook to update whenever the file digest changes
        // (when a new file is chosen), or when the storage subscription says the
        // value of the storage item has updated.
    }, [digest, api.query.templateModule]);
    
    // Callback function for when a new file is selected.
    const handleFileChosen = (file) => {
        fileReader = new FileReader();
        fileReader.onloadend = bufferToDigest;
        fileReader.readAsArrayBuffer(file);
    };
    
    // We can say a file digest is claimed if the stored block number is not 0.
    function isClaimed () {
        return block !== 0;
    }
    
    // The actual UI elements which are returned from our component.
    return (
        <Grid.Column width={8}>
            <h1>Proof of Existence</h1>
            
            <Card centered>
                <Card.Content textAlign='center'>
                    <Statistic
                        label='Current Value'
                        value={currentValue}
                    />
                </Card.Content>
            </Card>
            <Form>
                <Form.Field>
                    <Input
                        label='New Value'
                        state='newValue'
                        type='number'
                        onChange={(_, { value }) => setFormValue(value)}
                    />
                </Form.Field>
                <Form.Field style={{ textAlign: 'center' }}>
                    <TxButton
                        accountPair={accountPair}
                        label='Store Something'
                        type='SIGNED-TX'
                        setStatus={setStatus}
                        attrs={{
                            palletRpc: 'templateModule',
                            callable: 'doSomething',
                            inputParams: [formValue],
                            paramFields: [true]
                        }}
                    />
                </Form.Field>
            </Form>
            {/* Show warning or success message if the file is or is not claimed. */}
            <Form success={!!digest && !isClaimed()} warning={isClaimed()}>
                <Form.Field>
                    {/* File selector with a callback to `handleFileChosen`. */}
                    <Input
                        type='file'
                        id='file'
                        label='Your File'
                        onChange={ e => handleFileChosen(e.target.files[0]) }
                    />
                    {/* Show this message if the file is available to be claimed */}
                    <Message success header='File Digest Unclaimed' content={digest} />
                    {/* Show this message if the file is already claimed. */}
                    <Message
                        warning
                        header='File Digest Claimed'
                        list={[digest, `Owner: ${owner}`, `Block: ${block}`]}
                    />
                </Form.Field>
                {/* Buttons for interacting with the component. */}
                <Form.Field>
                    {/* Button to create a claim. Only active if a file is selected,
                        and not already claimed. Updates the `status`. */}
                    <TxButton
                        accountPair={accountPair}
                        label={'Create Claim'}
                        setStatus={setStatus}
                        type='SIGNED-TX'
                        disabled={isClaimed() || !digest}
                        attrs={{
                            palletRpc: 'templateModule',
                            callable: 'createClaim',
                            inputParams: [digest],
                            paramFields: [true]
                        }}
                    />
                    {/* Button to revoke a claim. Only active if a file is selected,
                        and is already claimed. Updates the `status`. */}
                    <TxButton
                        accountPair={accountPair}
                        label='Revoke Claim'
                        setStatus={setStatus}
                        type='SIGNED-TX'
                        disabled={!isClaimed() || owner !== accountPair.address}
                        attrs={{
                            palletRpc: 'templateModule',
                            callable: 'revokeClaim',
                            inputParams: [digest],
                            paramFields: [true]
                        }}
                    />
                </Form.Field>
                {/* Status message about the transaction. */}
                <div style={{ overflowWrap: 'break-word' }}>{status}</div>
            </Form>
        </Grid.Column>
    );
}

export default function TemplateModule (props) {
    const { api } = useSubstrate();
    return (api.query.templateModule && api.query.templateModule.something && api.query.templateModule.proofs
        ? <Main {...props} /> : null);
}
