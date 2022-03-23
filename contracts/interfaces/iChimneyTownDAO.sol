// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

interface iChimneyTownDAO {

    //******************************
    // view functions
    //******************************
    function nextPublicId() external view returns (uint256);

    function nextReserveId() external view returns (uint256);

    function priceInWei() external view returns (uint256);

    function isOnSale() external view returns (bool);

    function merkleRoot() external view returns (bytes32);

    function isClaimed(address account) external view returns (bool);

    //******************************
    // public functions
    //******************************
    function mint() external payable;

    function mintBatch(uint256 quantity) external payable;

    function claim(bytes32[] calldata merkleProof) external payable;

    //******************************
    // admin functions
    //******************************
    function updateImageURL(string memory url) external;

    function updateAnimationURL(string memory url) external;

    function updateExternalURL(string memory url) external;

    function freezeMetadata() external;

    function mintReserve(uint256 quantity, address to) external;

    function setMerkleRoot(bytes32 merkleRoot) external;

    function setPrice(uint256 priceInWei) external;

    function setSaleStatus(bool isOnSale) external;

    function withdraw(address payable to, uint256 amountInWei) external;
}
